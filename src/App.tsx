import { useEffect, useMemo, useState } from "react";
import Canvas from "./components/canvas/Canvas";
import Toolbar from "./components/toolbar/Toolbar";
import WorkspacePanel from "./components/sidebar/WorkspacePanel";
import ContextMenu from "./components/toolbar/ContextMenu";
import { useShortcuts } from "./hooks/useShortcuts";
import { loadInitialData, useScarecrowStore } from "./store";
import { createAssetObjectUrl } from "./lib/assets";
import { parseVideoUrl, pluralize } from "./lib/utils";
import { ChevronRightIcon } from "./components/common/Icons";
import { closeCurrentWindow, isTauriRuntime, listenAppEvent } from "./lib/platform";

interface DragDropPayload {
  kind: "enter" | "over" | "drop" | "leave";
  paths: string[];
  x: number;
  y: number;
}

interface ImageViewerProps {
  assetUrl: string | null;
  title: string;
  loading: boolean;
  error: string | null;
  standalone?: boolean;
  onClose: () => void;
}

const ImageViewer = ({
  assetUrl,
  title,
  loading,
  error,
  standalone = false,
  onClose
}: ImageViewerProps) => (
  <div className="viewer-root">
    <div className="viewer-toolbar" {...(standalone ? { "data-tauri-drag-region": true } : {})}>
      <div className="viewer-title">{title}</div>
      <button type="button" className="viewer-close" onClick={onClose}>
        Close
      </button>
    </div>
    <div className="viewer-stage">
      {loading ? <div className="video-loading viewer-loading" /> : null}
      {error ? <div className="media-error viewer-error">{error}</div> : null}
      {assetUrl ? (
        <img className="viewer-image" src={assetUrl} alt={title} />
      ) : null}
    </div>
  </div>
);

const VideoModal = () => {
  const addBlock = useScarecrowStore((state) => state.addBlock);
  const setVideoModal = useScarecrowStore((state) => state.setVideoModal);
  const modal = useScarecrowStore((state) => state.videoModal);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  return (
    <div
      className="modal-backdrop"
      onClick={() => setVideoModal({ open: false, position: null })}
    >
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">Add video</div>
        <input
          className="modal-input"
          value={url}
          placeholder="Paste a YouTube or TikTok URL"
          onChange={(event) => {
            setUrl(event.target.value);
            setError("");
          }}
          autoFocus
        />
        {error ? <div className="modal-error">{error}</div> : null}
        <div className="modal-actions">
          <button
            type="button"
            className="button subtle"
            onClick={() => setVideoModal({ open: false, position: null })}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              const parsed = parseVideoUrl(url);
              if (!parsed || !modal.position) {
                setError("Use a valid YouTube or TikTok URL.");
                return;
              }
              addBlock("video", modal.position.x, modal.position.y, parsed);
              setVideoModal({ open: false, position: null });
              setUrl("");
            }}
          >
            Add video
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  useShortcuts();

  const viewerParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const viewer = params.get("viewer");
    const asset = params.get("asset");

    return {
      isStandaloneImageViewer: viewer === "image" && Boolean(asset),
      asset: asset ? decodeURIComponent(asset) : null
    };
  }, []);

  const bootstrap = useScarecrowStore((state) => state.bootstrap);
  const ensureWorkspaceScaffold = useScarecrowStore(
    (state) => state.ensureWorkspaceScaffold
  );
  const ready = useScarecrowStore((state) => state.ready);
  const loading = useScarecrowStore((state) => state.loading);
  const sidebarCollapsed = useScarecrowStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useScarecrowStore((state) => state.toggleSidebar);
  const currentPageId = useScarecrowStore((state) => state.currentPageId);
  const pages = useScarecrowStore((state) => state.pages);
  const blocks = useScarecrowStore((state) => state.blocks);
  const contextMenu = useScarecrowStore((state) => state.contextMenu);
  const setContextMenu = useScarecrowStore((state) => state.setContextMenu);
  const viewport = useScarecrowStore((state) => state.viewport);
  const setViewport = useScarecrowStore((state) => state.setViewport);
  const setDragOverlay = useScarecrowStore((state) => state.setDragOverlay);
  const videoModal = useScarecrowStore((state) => state.videoModal);
  const imageViewer = useScarecrowStore((state) => state.imageViewer);
  const setImageViewer = useScarecrowStore((state) => state.setImageViewer);

  const [viewerAsset, setViewerAsset] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);

  const currentPage = useMemo(
    () => pages.find((page) => page.id === currentPageId) ?? null,
    [currentPageId, pages]
  );

  const currentBlocks = useMemo(
    () => Object.values(blocks).filter((block) => block.pageId === currentPageId),
    [blocks, currentPageId]
  );

  const viewerRequest = viewerParams.isStandaloneImageViewer
    ? {
        open: true,
        assetPath: viewerParams.asset,
        title: "Scarecrow Viewer",
        standalone: true
      }
    : imageViewer.open
      ? {
          open: true,
          assetPath: imageViewer.assetPath,
          title: imageViewer.name || "Scarecrow Viewer",
          standalone: false
        }
      : {
          open: false,
          assetPath: null,
          title: "Scarecrow Viewer",
          standalone: false
        };

  useEffect(() => {
    if (viewerRequest.standalone) {
      return;
    }

    void (async () => {
      try {
        const payload = await loadInitialData();
        bootstrap(payload);
        await ensureWorkspaceScaffold();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Scarecrow failed to start.";
        console.error("Failed to bootstrap Scarecrow", error);
        setStartupError(message);
      }
    })();
  }, [bootstrap, ensureWorkspaceScaffold, viewerRequest.standalone]);

  useEffect(() => {
    if (!viewerRequest.open || !viewerRequest.assetPath) {
      setViewerAsset(null);
      setViewerError(null);
      setViewerLoading(false);
      return;
    }

    const assetPath = viewerRequest.assetPath;
    let active = true;
    setViewerLoading(true);
    setViewerError(null);

    void (async () => {
      try {
        const url = await createAssetObjectUrl(assetPath);
        if (!active) {
          return;
        }
        setViewerAsset(url);
      } catch (error) {
        if (!active) {
          return;
        }
        setViewerAsset(null);
        setViewerError(
          error instanceof Error ? error.message : "The image viewer could not open this file."
        );
      } finally {
        if (active) {
          setViewerLoading(false);
        }
      }
    })();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (viewerRequest.standalone) {
          void closeCurrentWindow();
        } else {
          setImageViewer({ open: false, assetPath: null, name: null });
        }
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      active = false;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [setImageViewer, viewerRequest.assetPath, viewerRequest.open, viewerRequest.standalone]);

  useEffect(() => {
    if (viewerRequest.standalone) {
      return;
    }

    const unlistenPromise = listenAppEvent<DragDropPayload>(
      "scarecrow://drag-drop",
      async (event) => {
        const payload = event.payload;
        if (payload.kind === "leave") {
          setDragOverlay({ active: false, paths: [] });
          return;
        }
        if (payload.kind === "enter" || payload.kind === "over") {
          setDragOverlay({
            active: true,
            x: payload.x,
            y: payload.y,
            paths: payload.paths.length ? payload.paths : undefined
          });
          return;
        }
        if (payload.kind === "drop") {
          setDragOverlay({ active: false, paths: [] });
          window.dispatchEvent(
            new CustomEvent("scarecrow-drop", {
              detail: payload
            })
          );
        }
      }
    );
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setDragOverlay, viewerRequest.standalone]);

  const statusCount = useMemo(() => pluralize(currentBlocks.length, "block"), [currentBlocks]);

  const closeViewer = () => {
    if (viewerRequest.standalone) {
      void closeCurrentWindow();
    } else {
      setImageViewer({ open: false, assetPath: null, name: null });
    }
  };

  const viewerNode = viewerRequest.open ? (
    <ImageViewer
      assetUrl={viewerAsset}
      title={viewerRequest.title}
      loading={viewerLoading}
      error={viewerError}
      standalone={viewerRequest.standalone}
      onClose={closeViewer}
    />
  ) : null;

  if (viewerRequest.standalone) {
    return viewerNode;
  }

  return (
    <div
      className="app-shell"
      onClick={() => {
        if (contextMenu) {
          setContextMenu(null);
        }
      }}
    >
      <Toolbar />
      <WorkspacePanel />
      {sidebarCollapsed ? (
        <button
          type="button"
          className="workspace-reopen"
          onClick={toggleSidebar}
          title="Open workspace panel"
        >
          <ChevronRightIcon />
        </button>
      ) : null}
      <main
        className="app-main"
        style={{
          left: sidebarCollapsed ? 52 : 272
        }}
      >
        {ready ? <Canvas /> : null}
      </main>
      {contextMenu ? <ContextMenu /> : null}
      <div className="status-bar">
        <div className="status-slot">{currentPage?.name ?? "Loading..."}</div>
        <button
          className="status-slot status-center"
          type="button"
          onClick={() =>
            setViewport((current) => ({
              ...current,
              zoom: 1
            }))
          }
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <div className="status-slot status-right">{statusCount}</div>
      </div>
      {videoModal.open ? <VideoModal /> : null}
      {viewerRequest.open ? <div className="viewer-overlay">{viewerNode}</div> : null}
      {loading ? <div className="boot-overlay">Loading workspace...</div> : null}
      {startupError ? (
        <div className="fatal-overlay">
          <div className="fatal-card">
            <div className="modal-title">Scarecrow couldn&apos;t start</div>
            <div className="fatal-text">{startupError}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default App;
