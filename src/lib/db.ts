import { invoke } from "@tauri-apps/api/core";
import type { Block, Page, StoragePaths, Workspace } from "./types";
import { parseBlockContent } from "./utils";

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

export const getStoragePaths = () => {
  if (!storagePathsPromise) {
    storagePathsPromise = invoke<StoragePaths>("get_storage_paths");
  }
  return storagePathsPromise;
};

export const loadWorkspaces = async (): Promise<Workspace[]> => {
  const rows = await invoke<CommandWorkspace[]>("read_workspaces");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt
  }));
};

export const loadPages = async (): Promise<Page[]> => {
  const rows = await invoke<CommandPage[]>("read_pages", { workspaceId: null });
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    createdAt: row.createdAt
  }));
};

export const loadBlocks = async (): Promise<Record<string, Block>> => {
  const rows = await invoke<CommandBlock[]>("read_blocks", { pageId: null });
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

export const upsertWorkspace = async (workspace: Workspace) =>
  invoke("upsert_workspace", { workspace });

export const deleteWorkspace = async (workspaceId: string) =>
  invoke("delete_workspace", { workspaceId });

export const upsertPage = async (page: Page) => invoke("upsert_page", { page });

export const deletePage = async (pageId: string) =>
  invoke("delete_page", { pageId });

export const upsertBlock = async (block: Block) =>
  invoke("upsert_block", {
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

export const deleteBlock = async (blockId: string) =>
  invoke("delete_block", { blockId });

export const deleteBlocks = async (blockIds: string[]) =>
  invoke("delete_blocks", { blockIds });

export const importAsset = async (sourcePath: string) =>
  invoke<{
    assetPath: string;
    absolutePath: string;
    originalName: string;
    extension: string;
  }>("import_asset", { sourcePath });

export const openFileInOs = async (path: string) =>
  invoke("open_file_in_os", { path });

export const openAssetInOs = async (relativePath: string) =>
  invoke("open_asset_in_os", { relativePath });

export const openImageViewer = async (relativePath: string) =>
  invoke("open_image_viewer", { relativePath });
