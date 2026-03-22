export type Tool = "select" | "note" | "image" | "pdf" | "video" | "hand";
export type BlockType = "note" | "image" | "pdf" | "video";

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

export interface Page {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
}

export interface NoteBlockContent {
  html: string;
  bgColor: string;
}

export interface ImageBlockContent {
  assetPath: string;
  originalName: string;
  aspectRatio: number;
}

export interface PdfBlockContent {
  assetPath: string;
  currentPage: number;
  totalPages: number;
  zoom: number;
  aspectRatio?: number;
}

export interface VideoBlockContent {
  url: string;
  platform: "youtube" | "tiktok";
  videoId: string;
  thumbnailUrl: string;
}

export interface BlockBase<T> {
  id: string;
  pageId: string;
  type: BlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: T;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

export type NoteBlock = BlockBase<NoteBlockContent> & { type: "note" };
export type ImageBlock = BlockBase<ImageBlockContent> & { type: "image" };
export type PdfBlock = BlockBase<PdfBlockContent> & { type: "pdf" };
export type VideoBlock = BlockBase<VideoBlockContent> & { type: "video" };
export type Block = NoteBlock | ImageBlock | PdfBlock | VideoBlock;

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface SelectionBoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  blockIds: string[];
}

export interface VideoModalState {
  open: boolean;
  position: { x: number; y: number } | null;
}

export interface ImageViewerState {
  open: boolean;
  assetPath: string | null;
  name?: string | null;
}

export interface DragOverlayState {
  active: boolean;
  x: number;
  y: number;
  paths: string[];
}

export interface PersistedSnapshot {
  workspaces: Workspace[];
  pages: Page[];
  blocks: Record<string, Block>;
  currentWorkspaceId: string | null;
  currentPageId: string | null;
}

export interface StoragePaths {
  baseDir: string;
  dbPath: string;
  assetsDir: string;
}
