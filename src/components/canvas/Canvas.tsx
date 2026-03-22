import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import Grid from "./Grid";
import SelectionBox from "./SelectionBox";
import BlockShell from "./BlockShell";
import NoteBlock from "../blocks/NoteBlock";
import ImageBlock from "../blocks/ImageBlock";
import PDFBlock from "../blocks/PDFBlock";
import VideoBlock from "../blocks/VideoBlock";
import { useCanvas } from "../../hooks/useCanvas";
import { useScarecrowStore } from "../../store";
import { importAsset } from "../../lib/db";
import { resolveAssetUrl } from "../../lib/assets";
import { isImageFile, isPdfFile, screenToWorld } from "../../lib/utils";
import { pickImportSources } from "../../lib/platform";
import type { Block } from "../../lib/types";

interface DropEventDetail {
  paths: string[];
  x: number;
  y: number;
}

const loadImageAspect = async (relativePath: string) =>
  new Promise<number>((resolve) => {
    const image = new Image();
    void resolveAssetUrl(relativePath).then((url) => {
      image.src = url;
    });
    image.onload = () => resolve(image.naturalWidth / image.naturalHeight || 1.5);
    image.onerror = () => resolve(1.5);
  });

const getImportName = (source: string | File) =>
  typeof source === "string" ? source : source.name;

const Canvas = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const blockNodeMap = useRef(new Map<string, HTMLDivElement>());
  const fitStateRef = useRef({ pageId: null as string | null, fitRequest: -1 });
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  const { visibleBlocks, pageBlocks, viewport } = useCanvas(containerRect);
  const currentPageId = useScarecrowStore((state) => state.currentPageId);
  const activeTool = useScarecrowStore((state) =>
    state.spacePanning ? "hand" : state.activeTool
  );
  const spacePanning = useScarecrowStore((state) => state.spacePanning);
  const selection = useScarecrowStore((state) => state.selection);
  const selectionBox = useScarecrowStore((state) => state.selectionBox);
  const dragOverlay = useScarecrowStore((state) => state.dragOverlay);
  const fitRequest = useScarecrowStore((state) => state.fitRequest);
  const setViewport = useScarecrowStore((state) => state.setViewport);
  const addBlock = useScarecrowStore((state) => state.addBlock);
  const clearSelection = useScarecrowStore((state) => state.clearSelection);
  const setSelection = useScarecrowStore((state) => state.setSelection);
  const setSelectionBox = useScarecrowStore((state) => state.setSelectionBox);
  const setContextMenu = useScarecrowStore((state) => state.setContextMenu);
  const setDragOverlay = useScarecrowStore((state) => state.setDragOverlay);
  const setVideoModal = useScarecrowStore((state) => state.setVideoModal);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!worldRef.current) {
      return;
    }
    worldRef.current.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
  }, [viewport]);

  useEffect(() => {
    if (!containerRect) {
      return;
    }
    const pageChanged = fitStateRef.current.pageId !== currentPageId;
    const fitRequested = fitStateRef.current.fitRequest !== fitRequest;
    if (!pageChanged && !fitRequested) {
      return;
    }
    fitStateRef.current = { pageId: currentPageId, fitRequest };
    if (!pageBlocks.length) {
      setViewport({ x: containerRect.width / 2, y: containerRect.height / 2, zoom: 1 });
      return;
    }
    const left = Math.min(...pageBlocks.map((block) => block.x));
    const top = Math.min(...pageBlocks.map((block) => block.y));
    const right = Math.max(...pageBlocks.map((block) => block.x + block.width));
    const bottom = Math.max(...pageBlocks.map((block) => block.y + block.height));
    const width = Math.max(right - left, 320);
    const height = Math.max(bottom - top, 240);
    const zoom = Math.max(
      0.1,
      Math.min(4, Math.min((containerRect.width - 180) / width, (containerRect.height - 180) / height))
    );
    setViewport({
      zoom: Number.isFinite(zoom) ? zoom : 1,
      x: containerRect.width / 2 - (left + width / 2) * zoom,
      y: containerRect.height / 2 - (top + height / 2) * zoom
    });
  }, [containerRect, currentPageId, fitRequest, pageBlocks, setViewport]);

  const createImportedBlock = async (source: string | File, clientX: number, clientY: number) => {
    if (!containerRect) {
      return;
    }
    const world = screenToWorld({ x: clientX, y: clientY }, containerRect, viewport);
    const name = getImportName(source);

    if (isImageFile(name)) {
      const imported = await importAsset(source);
      const aspectRatio = await loadImageAspect(imported.assetPath);
      addBlock("image", world.x, world.y, {
        assetPath: imported.assetPath,
        originalName: imported.originalName,
        aspectRatio
      });
      return;
    }

    if (isPdfFile(name)) {
      const imported = await importAsset(source);
      addBlock("pdf", world.x, world.y, {
        assetPath: imported.assetPath,
        currentPage: 1,
        totalPages: 1,
        zoom: 1,
        aspectRatio: 210 / 297
      });
    }
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<DropEventDetail>).detail;
      detail.paths.forEach((path, index) => {
        void createImportedBlock(path, detail.x + index * 24, detail.y + index * 24);
      });
      setDragOverlay({ active: false, paths: [] });
    };
    window.addEventListener("scarecrow-drop", handler);
    return () => window.removeEventListener("scarecrow-drop", handler);
  }, [containerRect, viewport, setDragOverlay]);

  const handleCanvasAction = async (clientX: number, clientY: number) => {
    if (!containerRect) {
      return;
    }
    const world = screenToWorld({ x: clientX, y: clientY }, containerRect, viewport);

    if (activeTool === "note") {
      addBlock("note", world.x, world.y);
      return;
    }

    if (activeTool === "image") {
      const [source] = await pickImportSources(".jpg,.jpeg,.png,.gif,.webp,.svg");
      if (source) {
        await createImportedBlock(source, clientX, clientY);
      }
      return;
    }

    if (activeTool === "pdf") {
      const [source] = await pickImportSources(".pdf");
      if (source) {
        await createImportedBlock(source, clientX, clientY);
      }
      return;
    }

    if (activeTool === "video") {
      setVideoModal({ open: true, position: world });
    }
  };

  const renderBlock = (block: Block) => {
    switch (block.type) {
      case "note":
        return <NoteBlock block={block} selected={selection.includes(block.id)} />;
      case "image":
        return <ImageBlock block={block} />;
      case "pdf":
        return <PDFBlock block={block} />;
      case "video":
        return <VideoBlock block={block} />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        "canvas-root",
        activeTool === "hand" && "hand",
        spacePanning && "space-pan",
        ["note", "image", "pdf", "video"].includes(activeTool) && "placing"
      )}
      onWheel={(event) => {
        event.preventDefault();
        if (!containerRect) {
          return;
        }
        if (event.ctrlKey) {
          const cursorWorld = screenToWorld(
            { x: event.clientX, y: event.clientY },
            containerRect,
            viewport
          );
          const nextZoom = Math.max(
            0.1,
            Math.min(4, viewport.zoom * (event.deltaY > 0 ? 0.92 : 1.08))
          );
          setViewport({
            zoom: nextZoom,
            x: event.clientX - containerRect.left - cursorWorld.x * nextZoom,
            y: event.clientY - containerRect.top - cursorWorld.y * nextZoom
          });
          return;
        }
        setViewport((current) => ({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY
        }));
      }}
      onPointerDown={(event) => {
        setContextMenu(null);
        if (!containerRect) {
          return;
        }
        const target = event.target as HTMLElement;

        if (event.defaultPrevented || target.closest(".block-shell")) {
          return;
        }

        if (
          event.button === 1 ||
          activeTool === "hand" ||
          (spacePanning && event.button === 0)
        ) {
          const startViewport = viewport;
          const startX = event.clientX;
          const startY = event.clientY;
          const move = (moveEvent: PointerEvent) => {
            setViewport({
              ...startViewport,
              x: startViewport.x + (moveEvent.clientX - startX),
              y: startViewport.y + (moveEvent.clientY - startY)
            });
          };
          const up = () => {
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", up);
          };
          document.addEventListener("pointermove", move);
          document.addEventListener("pointerup", up);
          return;
        }

        if (event.button !== 0) {
          return;
        }

        if (activeTool !== "select") {
          void handleCanvasAction(event.clientX, event.clientY);
          return;
        }

        const origin = { x: event.clientX, y: event.clientY };
        clearSelection();
        setSelectionBox({
          x: event.clientX - containerRect.left,
          y: event.clientY - containerRect.top,
          width: 0,
          height: 0
        });

        const move = (moveEvent: PointerEvent) => {
          const x = Math.min(origin.x, moveEvent.clientX);
          const y = Math.min(origin.y, moveEvent.clientY);
          setSelectionBox({
            x: x - containerRect.left,
            y: y - containerRect.top,
            width: Math.abs(moveEvent.clientX - origin.x),
            height: Math.abs(moveEvent.clientY - origin.y)
          });
        };

        const up = (upEvent: PointerEvent) => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          const start = screenToWorld(origin, containerRect, viewport);
          const end = screenToWorld(
            { x: upEvent.clientX, y: upEvent.clientY },
            containerRect,
            viewport
          );
          const bounds = {
            left: Math.min(start.x, end.x),
            top: Math.min(start.y, end.y),
            right: Math.max(start.x, end.x),
            bottom: Math.max(start.y, end.y)
          };
          if (Math.abs(upEvent.clientX - origin.x) < 3 && Math.abs(upEvent.clientY - origin.y) < 3) {
            setSelectionBox(null);
            return;
          }
          setSelection(
            pageBlocks
              .filter(
                (block) =>
                  block.x < bounds.right &&
                  block.x + block.width > bounds.left &&
                  block.y < bounds.bottom &&
                  block.y + block.height > bounds.top
              )
              .map((block) => block.id)
          );
          setSelectionBox(null);
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      }}
    >
      <Grid />
      <div ref={worldRef} id="canvas-world" className="canvas-world">
        {visibleBlocks.map((block) => (
          <BlockShell
            key={block.id}
            block={block}
            selected={selection.includes(block.id)}
            selectionIds={selection}
            registerNode={(id, node) => {
              if (node) {
                blockNodeMap.current.set(id, node);
              } else {
                blockNodeMap.current.delete(id);
              }
            }}
            getNode={(id) => blockNodeMap.current.get(id) ?? null}
          >
            {renderBlock(block)}
          </BlockShell>
        ))}
      </div>
      {selectionBox ? <SelectionBox box={selectionBox} /> : null}
      {dragOverlay.active ? <div className="canvas-drop-overlay" /> : null}
    </div>
  );
};

export default Canvas;
