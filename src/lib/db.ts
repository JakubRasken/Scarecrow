import type { Block, Page, StoragePaths, Workspace } from "./types";
import { parseBlockContent } from "./utils";
import {
  readBrowserAsset,
  readBrowserSnapshot,
  writeBrowserAsset,
  writeBrowserSnapshot
} from "./browserStorage";
import { isTauriRuntime } from "./platform";

interface CommandWorkspace {
  id: string;
  name: string;
  createdAt: number;
}

interface CommandPage {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
}

interface CommandBlock {
  id: string;
  pageId: string;
  type: Block["type"];
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

let storagePathsPromise: Promise<StoragePaths> | null = null;

const invokeTauri = async <T>(command: string, args?: Record<string, unknown>) => {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const getExtension = (name: string) => {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1]?.toLowerCase() ?? "" : "";
};

export const getStoragePaths = () => {
  if (!storagePathsPromise) {
    storagePathsPromise = isTauriRuntime()
      ? invokeTauri<StoragePaths>("get_storage_paths")
      : Promise.resolve({
          baseDir: "browser://local-storage",
          dbPath: "browser://local-storage/db",
          assetsDir: "browser://local-storage/assets"
        });
  }
  return storagePathsPromise;
};

export const loadWorkspaces = async (): Promise<Workspace[]> => {
  if (!isTauriRuntime()) {
    return readBrowserSnapshot().workspaces;
  }

  const rows = await invokeTauri<CommandWorkspace[]>("read_workspaces");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt
  }));
};

export const loadPages = async (): Promise<Page[]> => {
  if (!isTauriRuntime()) {
    return readBrowserSnapshot().pages;
  }

  const rows = await invokeTauri<CommandPage[]>("read_pages", { workspaceId: null });
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    createdAt: row.createdAt
  }));
};

export const loadBlocks = async (): Promise<Record<string, Block>> => {
  if (!isTauriRuntime()) {
    return readBrowserSnapshot().blocks;
  }

  const rows = await invokeTauri<CommandBlock[]>("read_blocks", { pageId: null });
  return rows.reduce<Record<string, Block>>((accumulator, row) => {
    accumulator[row.id] = {
      id: row.id,
      pageId: row.pageId,
      type: row.type,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      content: parseBlockContent(row.type, row.content),
      zIndex: row.zIndex,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    } as Block;
    return accumulator;
  }, {});
};

export const upsertWorkspace = async (workspace: Workspace) => {
  if (!isTauriRuntime()) {
    const snapshot = readBrowserSnapshot();
    snapshot.workspaces = snapshot.workspaces.some((item) => item.id === workspace.id)
      ? snapshot.workspaces.map((item) => (item.id === workspace.id ? workspace : item))
      : [...snapshot.workspaces, workspace];
    writeBrowserSnapshot(snapshot);
    return;
  }

  await invokeTauri("upsert_workspace", { workspace });
};

export const deleteWorkspace = async (workspaceId: string) => {
  if (!isTauriRuntime()) {
    const snapshot = readBrowserSnapshot();
    snapshot.workspaces = snapshot.workspaces.filter((item) => item.id !== workspaceId);
    snapshot.pages = snapshot.pages.filter((item) => item.workspaceId !== workspaceId);
    snapshot.blocks = Object.fromEntries(
      Object.entries(snapshot.blocks).filter(([, block]) =>
        snapshot.pages.some((page) => page.id === block.pageId)
      )
    );
    writeBrowserSnapshot(snapshot);
    return;
  }

  await invokeTauri("delete_workspace", { workspaceId });
};

export const upsertPage = async (page: Page) => {
  if (!isTauriRuntime()) {
    const snapshot = readBrowserSnapshot();
    snapshot.pages = snapshot.pages.some((item) => item.id === page.id)
      ? snapshot.pages.map((item) => (item.id === page.id ? page : item))
      : [...snapshot.pages, page];
    writeBrowserSnapshot(snapshot);
    return;
  }

  await invokeTauri("upsert_page", { page });
};

export const deletePage = async (pageId: string) => {
  if (!isTauriRuntime()) {
    const snapshot = readBrowserSnapshot();
    snapshot.pages = snapshot.pages.filter((item) => item.id !== pageId);
    snapshot.blocks = Object.fromEntries(
      Object.entries(snapshot.blocks).filter(([, block]) => block.pageId !== pageId)
    );
    writeBrowserSnapshot(snapshot);
    return;
  }

  await invokeTauri("delete_page", { pageId });
};

export const upsertBlock = async (block: Block) => {
  if (!isTauriRuntime()) {
    const snapshot = readBrowserSnapshot();
    snapshot.blocks[block.id] = block;
    writeBrowserSnapshot(snapshot);
    return;
  }

  await invokeTauri("upsert_block", {
    block: {
      id: block.id,
      pageId: block.pageId,
      type: block.type,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      content: JSON.stringify(block.content),
      zIndex: block.zIndex,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt
    }
  });
};

export const deleteBlock = async (blockId: string) => {
  if (!isTauriRuntime()) {
    const snapshot = readBrowserSnapshot();
    delete snapshot.blocks[blockId];
    writeBrowserSnapshot(snapshot);
    return;
  }

  await invokeTauri("delete_block", { blockId });
};

export const deleteBlocks = async (blockIds: string[]) => {
  if (!isTauriRuntime()) {
    const snapshot = readBrowserSnapshot();
    for (const blockId of blockIds) {
      delete snapshot.blocks[blockId];
    }
    writeBrowserSnapshot(snapshot);
    return;
  }

  await invokeTauri("delete_blocks", { blockIds });
};

export const importAsset = async (source: string | File) => {
  if (!isTauriRuntime()) {
    if (!(source instanceof File)) {
      throw new Error("Browser imports require a File object.");
    }

    const extension = getExtension(source.name);
    const assetPath = `web-assets/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
    const dataUrl = await readFileAsDataUrl(source);
    writeBrowserAsset(assetPath, dataUrl);

    return {
      assetPath,
      absolutePath: assetPath,
      originalName: source.name,
      extension
    };
  }

  return invokeTauri<{
    assetPath: string;
    absolutePath: string;
    originalName: string;
    extension: string;
  }>("import_asset", { sourcePath: source });
};

export const openFileInOs = async (path: string) => {
  if (!isTauriRuntime()) {
    window.open(path, "_blank", "noopener,noreferrer");
    return;
  }

  await invokeTauri("open_file_in_os", { path });
};

export const openAssetInOs = async (relativePath: string) => {
  if (!isTauriRuntime()) {
    const asset = readBrowserAsset(relativePath);
    if (asset) {
      window.open(asset, "_blank", "noopener,noreferrer");
    }
    return;
  }

  await invokeTauri("open_asset_in_os", { relativePath });
};

export const openImageViewer = async (_relativePath: string) => {
  if (!isTauriRuntime()) {
    return;
  }

  await invokeTauri("open_image_viewer", { relativePath: _relativePath });
};
