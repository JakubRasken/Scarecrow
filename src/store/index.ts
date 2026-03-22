import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  Block,
  BlockType,
  ContextMenuState,
  DragOverlayState,
  ImageViewerState,
  Page,
  PersistedSnapshot,
  SelectionBoxState,
  Tool,
  VideoModalState,
  ViewportState,
  Workspace
} from "../lib/types";
import * as db from "../lib/db";
import {
  cloneSnapshot,
  createBlock,
  getDefaultContent,
  nextZIndex,
  now
} from "../lib/utils";

interface BootstrapPayload {
  workspaces: Workspace[];
  pages: Page[];
  blocks: Record<string, Block>;
}

interface ScarecrowState {
  ready: boolean;
  loading: boolean;
  activeTool: Tool;
  spacePanning: boolean;
  sidebarCollapsed: boolean;
  workspaces: Workspace[];
  pages: Page[];
  blocks: Record<string, Block>;
  currentWorkspaceId: string | null;
  currentPageId: string | null;
  selection: string[];
  editingBlockId: string | null;
  viewport: ViewportState;
  selectionBox: SelectionBoxState | null;
  contextMenu: ContextMenuState | null;
  dragOverlay: DragOverlayState;
  videoModal: VideoModalState;
  imageViewer: ImageViewerState;
  clipboard: Block[];
  history: PersistedSnapshot[];
  future: PersistedSnapshot[];
  fitRequest: number;
  bootstrap: (payload: BootstrapPayload) => void;
  setTool: (tool: Tool) => void;
  setSpacePanning: (active: boolean) => void;
  toggleSidebar: () => void;
  setViewport: (updater: ViewportState | ((viewport: ViewportState) => ViewportState)) => void;
  panBy: (dx: number, dy: number) => void;
  requestFitToContent: () => void;
  setSelection: (ids: string[]) => void;
  selectBlock: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  setEditingBlockId: (id: string | null) => void;
  setSelectionBox: (box: SelectionBoxState | null) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setDragOverlay: (overlay: Partial<DragOverlayState>) => void;
  setVideoModal: (modal: VideoModalState) => void;
  setImageViewer: (viewer: ImageViewerState) => void;
  ensureWorkspaceScaffold: () => Promise<void>;
  createWorkspace: (name?: string) => Promise<Workspace>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  createPage: (workspaceId?: string, name?: string) => Promise<Page | null>;
  renamePage: (pageId: string, name: string) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  setCurrentPage: (pageId: string) => void;
  addBlock: <T extends BlockType>(
    type: T,
    x: number,
    y: number,
    content?: Extract<Block, { type: T }>["content"]
  ) => Block | null;
  insertBlock: (block: Block, options?: { skipHistory?: boolean }) => void;
  updateBlock: (
    blockId: string,
    patch: Partial<Block>,
    options?: { skipHistory?: boolean; immediate?: boolean }
  ) => void;
  deleteBlocks: (ids: string[]) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateBlocks: (
    ids: string[],
    delta?: { x: number; y: number },
    options?: { select?: boolean; skipHistory?: boolean }
  ) => string[];
  duplicateSelection: () => void;
  bringToFront: (ids?: string[]) => void;
  sendToBack: (ids?: string[]) => void;
  selectAllCurrentPage: () => void;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 50;
let persistTimer: number | null = null;
const dirtyBlockIds = new Set<string>();
const deletedBlockIds = new Set<string>();

const snapshotState = (state: ScarecrowState): PersistedSnapshot =>
  cloneSnapshot({
    workspaces: state.workspaces,
    pages: state.pages,
    blocks: state.blocks,
    currentWorkspaceId: state.currentWorkspaceId,
    currentPageId: state.currentPageId
  });

const pushHistory = (state: ScarecrowState) => ({
  history: [...state.history, snapshotState(state)].slice(-MAX_HISTORY),
  future: []
});

const createDuplicateBlocks = (
  state: Pick<ScarecrowState, "blocks" | "currentPageId">,
  ids: string[],
  delta: { x: number; y: number }
) => {
  const selectedBlocks = ids
    .map((id) => state.blocks[id])
    .filter((block): block is Block => Boolean(block))
    .sort((a, b) => a.zIndex - b.zIndex);

  let zIndex = nextZIndex(
    Object.values(state.blocks).filter((block) => block.pageId === state.currentPageId)
  );
  const nextBlocks = { ...state.blocks };
  const duplicatedIds: string[] = [];

  for (const block of selectedBlocks) {
    const duplicate: Block = {
      ...cloneSnapshot(block),
      id: uuidv4(),
      x: block.x + delta.x,
      y: block.y + delta.y,
      zIndex: zIndex++,
      createdAt: now(),
      updatedAt: now()
    };
    nextBlocks[duplicate.id] = duplicate;
    dirtyBlockIds.add(duplicate.id);
    duplicatedIds.push(duplicate.id);
  }

  return { nextBlocks, duplicatedIds };
};

const flushPersistence = async (blocks: Record<string, Block>) => {
  const deletions = Array.from(deletedBlockIds);
  deletedBlockIds.clear();
  if (deletions.length) {
    await db.deleteBlocks(deletions);
  }

  const ids = Array.from(dirtyBlockIds);
  dirtyBlockIds.clear();
  await Promise.all(
    ids
      .map((id) => blocks[id])
      .filter((block): block is Block => Boolean(block))
      .map((block) => db.upsertBlock(block))
  );
};

const schedulePersistence = (get: () => ScarecrowState) => {
  if (persistTimer) {
    window.clearTimeout(persistTimer);
  }
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void flushPersistence(get().blocks);
  }, 500);
};

export const useScarecrowStore = create<ScarecrowState>((set, get) => ({
  ready: false,
  loading: true,
  activeTool: "select",
  spacePanning: false,
  sidebarCollapsed: false,
  workspaces: [],
  pages: [],
  blocks: {},
  currentWorkspaceId: null,
  currentPageId: null,
  selection: [],
  editingBlockId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  selectionBox: null,
  contextMenu: null,
  dragOverlay: {
    active: false,
    x: 0,
    y: 0,
    paths: []
  },
  videoModal: {
    open: false,
    position: null
  },
  imageViewer: {
    open: false,
    assetPath: null,
    name: null
  },
  clipboard: [],
  history: [],
  future: [],
  fitRequest: 0,

  bootstrap: ({ workspaces, pages, blocks }) => {
    const firstWorkspace = workspaces[0] ?? null;
    const firstPage =
      pages.find((page) => page.workspaceId === firstWorkspace?.id) ?? pages[0] ?? null;
    set({
      ready: true,
      loading: false,
      workspaces,
      pages,
      blocks,
      currentWorkspaceId: firstWorkspace?.id ?? null,
      currentPageId: firstPage?.id ?? null
    });
  },

  setTool: (tool) => set({ activeTool: tool }),

  setSpacePanning: (active) => set({ spacePanning: active }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setViewport: (updater) =>
    set((state) => ({
      viewport: typeof updater === "function" ? updater(state.viewport) : updater
    })),

  panBy: (dx, dy) =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        x: state.viewport.x + dx,
        y: state.viewport.y + dy
      }
    })),

  requestFitToContent: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),

  setSelection: (ids) => set({ selection: ids }),

  selectBlock: (id, additive = false) =>
    set((state) => ({
      selection: additive
        ? state.selection.includes(id)
          ? state.selection.filter((item) => item !== id)
          : [...state.selection, id]
        : [id],
      contextMenu: null
    })),

  clearSelection: () =>
    set({
      selection: [],
      editingBlockId: null,
      contextMenu: null,
      selectionBox: null
    }),

  setEditingBlockId: (id) => set({ editingBlockId: id }),

  setSelectionBox: (box) => set({ selectionBox: box }),

  setContextMenu: (menu) => set({ contextMenu: menu }),

  setDragOverlay: (overlay) =>
    set((state) => ({
      dragOverlay: {
        ...state.dragOverlay,
        ...overlay
      }
    })),

  setVideoModal: (modal) => set({ videoModal: modal }),

  setImageViewer: (viewer) => set({ imageViewer: viewer }),

  ensureWorkspaceScaffold: async () => {
    if (get().workspaces.length) {
      return;
    }
    const workspace = await get().createWorkspace("Scarecrow");
    await get().createPage(workspace.id, "Canvas");
  },

  createWorkspace: async (name = "Untitled Workspace") => {
    const workspace: Workspace = {
      id: uuidv4(),
      name,
      createdAt: now()
    };
    set((state) => ({
      ...pushHistory(state),
      workspaces: [...state.workspaces, workspace],
      currentWorkspaceId: workspace.id
    }));
    await db.upsertWorkspace(workspace);
    return workspace;
  },

  renameWorkspace: async (workspaceId, name) => {
    set((state) => {
      const workspaces = state.workspaces.map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, name } : workspace
      );
      const workspace = workspaces.find((item) => item.id === workspaceId);
      if (workspace) {
        void db.upsertWorkspace(workspace);
      }
      return {
        ...pushHistory(state),
        workspaces
      };
    });
  },

  createPage: async (workspaceId, name = "Untitled Page") => {
    const targetWorkspaceId = workspaceId ?? get().currentWorkspaceId;
    if (!targetWorkspaceId) {
      return null;
    }
    const page: Page = {
      id: uuidv4(),
      workspaceId: targetWorkspaceId,
      name,
      createdAt: now()
    };
    set((state) => ({
      ...pushHistory(state),
      pages: [...state.pages, page],
      currentWorkspaceId: targetWorkspaceId,
      currentPageId: page.id
    }));
    await db.upsertPage(page);
    return page;
  },

  renamePage: async (pageId, name) => {
    set((state) => {
      const pages = state.pages.map((page) =>
        page.id === pageId ? { ...page, name } : page
      );
      const page = pages.find((item) => item.id === pageId);
      if (page) {
        void db.upsertPage(page);
      }
      return {
        ...pushHistory(state),
        pages
      };
    });
  },

  deletePage: async (pageId) => {
    const existingPage = get().pages.find((page) => page.id === pageId);
    if (!existingPage) {
      return;
    }
    set((state) => {
      const nextBlocks = { ...state.blocks };
      Object.values(nextBlocks)
        .filter((block) => block.pageId === pageId)
        .forEach((block) => {
          delete nextBlocks[block.id];
          deletedBlockIds.add(block.id);
        });
      const remainingPages = state.pages.filter((page) => page.id !== pageId);
      const fallback =
        remainingPages.find((page) => page.workspaceId === existingPage.workspaceId) ?? null;
      return {
        ...pushHistory(state),
        pages: remainingPages,
        blocks: nextBlocks,
        currentPageId: fallback?.id ?? null,
        selection: []
      };
    });
    await db.deletePage(pageId);
    if (!get().pages.some((page) => page.workspaceId === existingPage.workspaceId)) {
      await get().createPage(existingPage.workspaceId, "Canvas");
    }
  },

  setCurrentPage: (pageId) =>
    set((state) => ({
      currentPageId: pageId,
      currentWorkspaceId:
        state.pages.find((page) => page.id === pageId)?.workspaceId ??
        state.currentWorkspaceId,
      selection: [],
      editingBlockId: null
    })),

  addBlock: (type, x, y, content) => {
    const state = get();
    if (!state.currentPageId) {
      return null;
    }
    const pageBlocks = Object.values(state.blocks).filter(
      (block) => block.pageId === state.currentPageId
    );
    const block = createBlock(
      type,
      state.currentPageId,
      x,
      y,
      nextZIndex(pageBlocks),
      (content ?? getDefaultContent(type)) as never
    );
    get().insertBlock(block);
    set({ activeTool: "select" });
    return block;
  },

  insertBlock: (block, options) => {
    set((state) => ({
      ...(options?.skipHistory ? {} : pushHistory(state)),
      blocks: {
        ...state.blocks,
        [block.id]: block
      },
      selection: [block.id]
    }));
    dirtyBlockIds.add(block.id);
    schedulePersistence(get);
  },

  updateBlock: (blockId, patch, options) => {
    set((state) => {
      const existing = state.blocks[blockId];
      if (!existing) {
        return state;
      }
      const updated = {
        ...existing,
        ...patch,
        updatedAt: now()
      } as Block;
      return {
        ...(options?.skipHistory ? {} : pushHistory(state)),
        blocks: {
          ...state.blocks,
          [blockId]: updated
        }
      };
    });
    if (options?.immediate) {
      void db.upsertBlock(get().blocks[blockId]);
      return;
    }
    dirtyBlockIds.add(blockId);
    schedulePersistence(get);
  },

  deleteBlocks: (ids) => {
    set((state) => {
      const nextBlocks = { ...state.blocks };
      ids.forEach((id) => {
        delete nextBlocks[id];
        deletedBlockIds.add(id);
      });
      return {
        ...pushHistory(state),
        blocks: nextBlocks,
        selection: []
      };
    });
    schedulePersistence(get);
  },

  copySelection: () => {
    const state = get();
    const clipboard = state.selection
      .map((id) => state.blocks[id])
      .filter((block): block is Block => Boolean(block))
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((block) => cloneSnapshot(block));

    set({ clipboard });
  },

  pasteClipboard: () => {
    const state = get();
    if (!state.currentPageId || !state.clipboard.length) {
      return;
    }

    let zIndex = nextZIndex(
      Object.values(state.blocks).filter((block) => block.pageId === state.currentPageId)
    );

    set((current) => {
      const nextBlocks = { ...current.blocks };
      const selection: string[] = [];

      for (const block of current.clipboard) {
        const duplicate: Block = {
          ...cloneSnapshot(block),
          id: uuidv4(),
          pageId: current.currentPageId ?? block.pageId,
          x: block.x + 40,
          y: block.y + 40,
          zIndex: zIndex++,
          createdAt: now(),
          updatedAt: now()
        };
        nextBlocks[duplicate.id] = duplicate;
        dirtyBlockIds.add(duplicate.id);
        selection.push(duplicate.id);
      }

      return {
        ...pushHistory(current),
        blocks: nextBlocks,
        selection
      };
    });

    schedulePersistence(get);
  },

  duplicateBlocks: (ids, delta = { x: 28, y: 28 }, options) => {
    const targetIds = ids.filter((id, index) => ids.indexOf(id) === index);
    if (!targetIds.length) {
      return [];
    }

    let duplicatedIds: string[] = [];
    set((state) => {
      const duplicates = createDuplicateBlocks(state, targetIds, delta);
      duplicatedIds = duplicates.duplicatedIds;
      return {
        ...(options?.skipHistory ? {} : pushHistory(state)),
        blocks: duplicates.nextBlocks,
        selection: options?.select === false ? state.selection : duplicatedIds
      };
    });

    if (duplicatedIds.length) {
      schedulePersistence(get);
    }

    return duplicatedIds;
  },

  duplicateSelection: () => {
    const state = get();
    if (!state.selection.length) {
      return;
    }
    get().duplicateBlocks(state.selection);
  },

  bringToFront: (ids) => {
    const targetIds = ids ?? get().selection;
    if (!targetIds.length) {
      return;
    }
    set((state) => {
      const currentPageBlocks = Object.values(state.blocks).filter(
        (block) => block.pageId === state.currentPageId
      );
      let zIndex = nextZIndex(currentPageBlocks);
      const nextBlocks = { ...state.blocks };
      targetIds.forEach((id) => {
        const block = nextBlocks[id];
        if (!block) {
          return;
        }
        nextBlocks[id] = { ...block, zIndex: zIndex++, updatedAt: now() };
        dirtyBlockIds.add(id);
      });
      return {
        ...pushHistory(state),
        blocks: nextBlocks
      };
    });
    schedulePersistence(get);
  },

  sendToBack: (ids) => {
    const targetIds = ids ?? get().selection;
    if (!targetIds.length) {
      return;
    }
    set((state) => {
      const currentPageBlocks = Object.values(state.blocks)
        .filter((block) => block.pageId === state.currentPageId)
        .sort((a, b) => a.zIndex - b.zIndex);
      const targetSet = new Set(targetIds);
      const reordered = [
        ...currentPageBlocks.filter((block) => targetSet.has(block.id)),
        ...currentPageBlocks.filter((block) => !targetSet.has(block.id))
      ];
      let zIndex = 1;
      const nextBlocks = { ...state.blocks };
      reordered.forEach((block) => {
        nextBlocks[block.id] = { ...block, zIndex: zIndex++, updatedAt: now() };
        dirtyBlockIds.add(block.id);
      });
      return {
        ...pushHistory(state),
        blocks: nextBlocks
      };
    });
    schedulePersistence(get);
  },

  selectAllCurrentPage: () => {
    const state = get();
    set({
      selection: Object.values(state.blocks)
        .filter((block) => block.pageId === state.currentPageId)
        .map((block) => block.id)
    });
  },

  undo: () => {
    const state = get();
    const previous = state.history[state.history.length - 1];
    if (!previous) {
      return;
    }
    const current = snapshotState(state);
    set({
      workspaces: previous.workspaces,
      pages: previous.pages,
      blocks: previous.blocks,
      currentWorkspaceId: previous.currentWorkspaceId,
      currentPageId: previous.currentPageId,
      selection: [],
      editingBlockId: null,
      history: state.history.slice(0, -1),
      future: [current, ...state.future].slice(0, MAX_HISTORY)
    });
    Object.keys(previous.blocks).forEach((id) => dirtyBlockIds.add(id));
    schedulePersistence(get);
  },

  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) {
      return;
    }
    const current = snapshotState(state);
    set({
      workspaces: next.workspaces,
      pages: next.pages,
      blocks: next.blocks,
      currentWorkspaceId: next.currentWorkspaceId,
      currentPageId: next.currentPageId,
      selection: [],
      editingBlockId: null,
      history: [...state.history, current].slice(-MAX_HISTORY),
      future: state.future.slice(1)
    });
    Object.keys(next.blocks).forEach((id) => dirtyBlockIds.add(id));
    schedulePersistence(get);
  }
}));

export const loadInitialData = async () => {
  const [workspaces, pages, blocks] = await Promise.all([
    db.loadWorkspaces(),
    db.loadPages(),
    db.loadBlocks()
  ]);
  return { workspaces, pages, blocks };
};
