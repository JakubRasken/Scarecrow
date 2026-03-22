#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('note','image','pdf','video')),
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  content TEXT NOT NULL,
  z_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pages_workspace ON pages(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id, z_index);
"#;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoragePaths {
    base_dir: String,
    db_path: String,
    assets_dir: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedAsset {
    asset_path: String,
    absolute_path: String,
    original_name: String,
    extension: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DragDropPayload {
    kind: String,
    paths: Vec<String>,
    x: f64,
    y: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRecord {
    id: String,
    name: String,
    created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageRecord {
    id: String,
    workspace_id: String,
    name: String,
    created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlockRecord {
    id: String,
    page_id: String,
    #[serde(rename = "type")]
    block_type: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    content: String,
    z_index: i64,
    created_at: i64,
    updated_at: i64,
}

fn storage_root(app: &AppHandle) -> Result<PathBuf, String> {
    if cfg!(target_os = "windows") {
        let appdata = std::env::var("APPDATA").map_err(|err| err.to_string())?;
        Ok(PathBuf::from(appdata).join("scarecrow"))
    } else {
        let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
        Ok(dir.join("scarecrow"))
    }
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(storage_root(app)?.join("scarecrow.db"))
}

fn assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(storage_root(app)?.join("assets"))
}

fn absolute_asset_path(app: &AppHandle, relative_path: &str) -> Result<PathBuf, String> {
    let assets = assets_dir(app)?;
    let relative = PathBuf::from(relative_path);
    let normalized = if relative.is_absolute() {
        relative
    } else {
        storage_root(app)?.join(relative)
    };

    if !normalized.starts_with(&assets) {
        return Err("Asset path is outside the allowed storage scope".into());
    }

    Ok(normalized)
}

fn normalize(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    Connection::open(path).map_err(|err| err.to_string())
}

fn ensure_storage(app: &AppHandle) -> Result<(), String> {
    let root = storage_root(app)?;
    let assets = assets_dir(app)?;
    fs::create_dir_all(root).map_err(|err| err.to_string())?;
    fs::create_dir_all(assets).map_err(|err| err.to_string())?;
    let connection = open_connection(app)?;
    connection
        .execute_batch(SCHEMA)
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_storage_paths(app: AppHandle) -> Result<StoragePaths, String> {
    ensure_storage(&app)?;
    let base_dir = storage_root(&app)?;
    let db = db_path(&app)?;
    let assets = assets_dir(&app)?;

    Ok(StoragePaths {
        base_dir: normalize(&base_dir),
        db_path: normalize(&db),
        assets_dir: normalize(&assets),
    })
}

#[tauri::command]
fn import_asset(app: AppHandle, source_path: String) -> Result<ImportedAsset, String> {
    ensure_storage(&app)?;
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("Source file does not exist".into());
    }

    let extension = source
        .extension()
        .map(|ext| ext.to_string_lossy().to_string())
        .unwrap_or_default();
    let file_name = source
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "asset".into());

    let asset_name = if extension.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        format!("{}.{}", Uuid::new_v4(), extension)
    };

    let dest_abs = assets_dir(&app)?.join(&asset_name);
    fs::copy(&source, &dest_abs).map_err(|err| err.to_string())?;

    Ok(ImportedAsset {
        asset_path: format!("assets/{}", asset_name),
        absolute_path: normalize(&dest_abs),
        original_name: file_name,
        extension,
    })
}

#[tauri::command]
fn open_file_in_os(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|err| err.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|err| err.to_string())?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn open_asset_in_os(app: AppHandle, relative_path: String) -> Result<(), String> {
    let absolute = absolute_asset_path(&app, &relative_path)?;
    open_file_in_os(normalize(&absolute))
}

#[tauri::command]
fn read_asset_bytes(app: AppHandle, relative_path: String) -> Result<Vec<u8>, String> {
    ensure_storage(&app)?;
    let absolute = absolute_asset_path(&app, &relative_path)?;
    fs::read(absolute).map_err(|err| err.to_string())
}

#[tauri::command]
fn open_image_viewer(relative_path: String, app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("image-viewer") {
        let _ = window.close();
    }

    let encoded = urlencoding::encode(&relative_path).to_string();
    let viewer_url = format!("index.html?viewer=image&asset={encoded}");

    WebviewWindowBuilder::new(
        &app,
        "image-viewer",
        WebviewUrl::App(viewer_url.into()),
    )
    .title("Scarecrow Viewer")
    .inner_size(1200.0, 820.0)
    .min_inner_size(640.0, 420.0)
    .resizable(true)
    .build()
    .map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
fn read_workspaces(app: AppHandle) -> Result<Vec<WorkspaceRecord>, String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;
    let mut statement = connection
        .prepare("SELECT id, name, created_at FROM workspaces ORDER BY created_at ASC")
        .map_err(|err| err.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok(WorkspaceRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|err| err.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn upsert_workspace(app: AppHandle, workspace: WorkspaceRecord) -> Result<(), String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;
    connection
        .execute(
            r#"
            INSERT INTO workspaces (id, name, created_at)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name
            "#,
            params![workspace.id, workspace.name, workspace.created_at],
        )
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_workspace(app: AppHandle, workspace_id: String) -> Result<(), String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;
    connection
        .execute(
            "DELETE FROM blocks WHERE page_id IN (SELECT id FROM pages WHERE workspace_id = ?1)",
            [workspace_id.as_str()],
        )
        .map_err(|err| err.to_string())?;
    connection
        .execute("DELETE FROM pages WHERE workspace_id = ?1", [workspace_id.as_str()])
        .map_err(|err| err.to_string())?;
    connection
        .execute("DELETE FROM workspaces WHERE id = ?1", [workspace_id.as_str()])
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_pages(app: AppHandle, workspace_id: Option<String>) -> Result<Vec<PageRecord>, String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;

    let query = if workspace_id.is_some() {
        "SELECT id, workspace_id, name, created_at FROM pages WHERE workspace_id = ?1 ORDER BY created_at ASC"
    } else {
        "SELECT id, workspace_id, name, created_at FROM pages ORDER BY created_at ASC"
    };

    let mut statement = connection.prepare(query).map_err(|err| err.to_string())?;
    let rows = if let Some(workspace_id) = workspace_id {
        statement
            .query_map([workspace_id], |row| {
                Ok(PageRecord {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .map_err(|err| err.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| err.to_string())?
    } else {
        statement
            .query_map([], |row| {
                Ok(PageRecord {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .map_err(|err| err.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| err.to_string())?
    };

    Ok(rows)
}

#[tauri::command]
fn upsert_page(app: AppHandle, page: PageRecord) -> Result<(), String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;
    connection
        .execute(
            r#"
            INSERT INTO pages (id, workspace_id, name, created_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              name = excluded.name
            "#,
            params![page.id, page.workspace_id, page.name, page.created_at],
        )
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_page(app: AppHandle, page_id: String) -> Result<(), String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;
    connection
        .execute("DELETE FROM blocks WHERE page_id = ?1", [page_id.as_str()])
        .map_err(|err| err.to_string())?;
    connection
        .execute("DELETE FROM pages WHERE id = ?1", [page_id.as_str()])
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_blocks(app: AppHandle, page_id: Option<String>) -> Result<Vec<BlockRecord>, String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;
    let query = if page_id.is_some() {
        r#"
        SELECT id, page_id, type, x, y, width, height, content, z_index, created_at, updated_at
        FROM blocks
        WHERE page_id = ?1
        ORDER BY z_index ASC, created_at ASC
        "#
    } else {
        r#"
        SELECT id, page_id, type, x, y, width, height, content, z_index, created_at, updated_at
        FROM blocks
        ORDER BY z_index ASC, created_at ASC
        "#
    };

    let mut statement = connection.prepare(query).map_err(|err| err.to_string())?;
    let mapper = |row: &rusqlite::Row<'_>| {
        Ok(BlockRecord {
            id: row.get(0)?,
            page_id: row.get(1)?,
            block_type: row.get(2)?,
            x: row.get(3)?,
            y: row.get(4)?,
            width: row.get(5)?,
            height: row.get(6)?,
            content: row.get(7)?,
            z_index: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    };

    let rows = if let Some(page_id) = page_id {
        statement
            .query_map([page_id], mapper)
            .map_err(|err| err.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| err.to_string())?
    } else {
        statement
            .query_map([], mapper)
            .map_err(|err| err.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| err.to_string())?
    };

    Ok(rows)
}

#[tauri::command]
fn upsert_block(app: AppHandle, block: BlockRecord) -> Result<(), String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;
    connection
        .execute(
            r#"
            INSERT INTO blocks (
              id, page_id, type, x, y, width, height, content, z_index, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(id) DO UPDATE SET
              page_id = excluded.page_id,
              type = excluded.type,
              x = excluded.x,
              y = excluded.y,
              width = excluded.width,
              height = excluded.height,
              content = excluded.content,
              z_index = excluded.z_index,
              updated_at = excluded.updated_at
            "#,
            params![
                block.id,
                block.page_id,
                block.block_type,
                block.x,
                block.y,
                block.width,
                block.height,
                block.content,
                block.z_index,
                block.created_at,
                block.updated_at
            ],
        )
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_block(app: AppHandle, block_id: String) -> Result<(), String> {
    ensure_storage(&app)?;
    let connection = open_connection(&app)?;
    connection
        .execute("DELETE FROM blocks WHERE id = ?1", [block_id.as_str()])
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_blocks(app: AppHandle, block_ids: Vec<String>) -> Result<(), String> {
    ensure_storage(&app)?;
    let mut connection = open_connection(&app)?;
    let tx = connection.transaction().map_err(|err| err.to_string())?;
    for block_id in block_ids {
        tx.execute("DELETE FROM blocks WHERE id = ?1", [block_id.as_str()])
            .map_err(|err| err.to_string())?;
    }
    tx.commit().map_err(|err| err.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            ensure_storage(&app.handle())?;
            Ok(())
        })
        .on_webview_event(|webview, event| {
            if let tauri::WebviewEvent::DragDrop(event) = event {
                let payload = match event {
                    tauri::DragDropEvent::Enter { paths, position } => DragDropPayload {
                        kind: "enter".into(),
                        paths: paths.iter().map(|path| normalize(path)).collect(),
                        x: position.x,
                        y: position.y,
                    },
                    tauri::DragDropEvent::Over { position } => DragDropPayload {
                        kind: "over".into(),
                        paths: Vec::new(),
                        x: position.x,
                        y: position.y,
                    },
                    tauri::DragDropEvent::Drop { paths, position } => DragDropPayload {
                        kind: "drop".into(),
                        paths: paths.iter().map(|path| normalize(path)).collect(),
                        x: position.x,
                        y: position.y,
                    },
                    tauri::DragDropEvent::Leave => DragDropPayload {
                        kind: "leave".into(),
                        paths: Vec::new(),
                        x: 0.0,
                        y: 0.0,
                    },
                    _ => return,
                };

                let _ = webview.emit("scarecrow://drag-drop", payload);
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_storage_paths,
            import_asset,
            open_file_in_os,
            open_asset_in_os,
            read_asset_bytes,
            open_image_viewer,
            read_workspaces,
            upsert_workspace,
            delete_workspace,
            read_pages,
            upsert_page,
            delete_page,
            read_blocks,
            upsert_block,
            delete_block,
            delete_blocks
        ])
        .run(tauri::generate_context!())
        .expect("failed to run scarecrow");
}
