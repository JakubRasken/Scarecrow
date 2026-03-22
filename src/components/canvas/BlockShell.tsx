import { memo, useMemo, useRef } from "react";
import clsx from "clsx";
import type { Block } from "../../lib/types";
import { useScarecrowStore } from "../../store";
import { A4_ASPECT_RATIO, clamp, getMinBlockSize } from "../../lib/utils";
import { useDrag } from "../../hooks/useDrag";
import { useResize } from "../../hooks/useResize";

type ResizeDirection = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface BlockShellProps {
  block: Block;
  selected: boolean;
  selectionIds: string[];
  registerNode: (id: string, node: HTMLDivElement | null) => void;
  getNode: (id: string) => HTMLDivElement | null;
  children: React.ReactNode;
}

const handles: ResizeDirection[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const getLockedAspectRatio = (block: Block, origin: Block) => {
  if (block.type === "image") {
    return block.content.aspectRatio || origin.width / origin.height;
  }
  if (block.type === "pdf") {
    return block.content.aspectRatio || A4_ASPECT_RATIO;
  }
  if (block.type === "video") {
    return origin.width / origin.height;
  }
  return null;
};

const computeResizeRect = (
  origin: Block,
  direction: ResizeDirection,
  deltaXWorld: number,
  deltaYWorld: number,
  min: { width: number; height: number },
  aspectRatio: number | null,
  freeScale: boolean
) => {
  let width = origin.width;
  let height = origin.height;
  let x = origin.x;
  let y = origin.y;

  if (direction.includes("e")) {
    width = clamp(origin.width + deltaXWorld, min.width, 4000);
  }
  if (direction.includes("s")) {
    height = clamp(origin.height + deltaYWorld, min.height, 4000);
  }
  if (direction.includes("w")) {
    width = clamp(origin.width - deltaXWorld, min.width, 4000);
    x = origin.x + (origin.width - width);
  }
  if (direction.includes("n")) {
    height = clamp(origin.height - deltaYWorld, min.height, 4000);
    y = origin.y + (origin.height - height);
  }

  if (!aspectRatio || freeScale) {
    return { x, y, width, height };
  }

  const horizontalOnly = direction === "e" || direction === "w";
  const verticalOnly = direction === "n" || direction === "s";

  if (Math.abs(deltaXWorld) >= Math.abs(deltaYWorld) || horizontalOnly) {
    height = clamp(width / aspectRatio, min.height, 4000);
    width = clamp(height * aspectRatio, min.width, 4000);
  } else {
    width = clamp(height * aspectRatio, min.width, 4000);
    height = clamp(width / aspectRatio, min.height, 4000);
  }

  if (direction.includes("w")) {
    x = origin.x + (origin.width - width);
  } else if (verticalOnly) {
    x = origin.x + (origin.width - width) / 2;
  } else {
    x = origin.x;
  }

  if (direction.includes("n")) {
    y = origin.y + (origin.height - height);
  } else if (horizontalOnly) {
    y = origin.y + (origin.height - height) / 2;
  } else {
    y = origin.y;
  }

  return { x, y, width, height };
};

const BlockShell = memo(
  ({ block, selected, selectionIds, registerNode, getNode, children }: BlockShellProps) => {
    const nodeRef = useRef<HTMLDivElement | null>(null);
    const blocks = useScarecrowStore((state) => state.blocks);
    const viewport = useScarecrowStore((state) => state.viewport);
    const selectBlock = useScarecrowStore((state) => state.selectBlock);
    const updateBlock = useScarecrowStore((state) => state.updateBlock);
    const duplicateBlocks = useScarecrowStore((state) => state.duplicateBlocks);
    const bringToFront = useScarecrowStore((state) => state.bringToFront);
    const setContextMenu = useScarecrowStore((state) => state.setContextMenu);
    const setEditingBlockId = useScarecrowStore((state) => state.setEditingBlockId);
    const setSelectionBox = useScarecrowStore((state) => state.setSelectionBox);
    const drag = useDrag();
    const resize = useResize();

    const style = useMemo(
      () => ({
        width: block.width,
        height: block.height,
        transform: `translate(${block.x}px, ${block.y}px)`
      }),
      [block.height, block.width, block.x, block.y]
    );

    const applyDragTransform = (deltaX: number, deltaY: number) => {
      const ids = selected ? selectionIds : [block.id];
      ids.forEach((id) => {
        const target = getNode(id);
        const source = blocks[id];
        if (!target || !source) {
          return;
        }
        target.style.transform = `translate(${source.x + deltaX / viewport.zoom}px, ${source.y + deltaY / viewport.zoom}px)`;
      });
    };

    const commitDrag = (deltaX: number, deltaY: number, duplicateOnDrop = false) => {
      const ids = selected ? selectionIds : [block.id];
      if (duplicateOnDrop) {
        duplicateBlocks(ids, {
          x: deltaX / viewport.zoom,
          y: deltaY / viewport.zoom
        });
        ids.forEach((id) => {
          const target = getNode(id);
          if (target) {
            target.style.transform = "";
          }
        });
        return;
      }
      ids.forEach((id, index) => {
        const source = blocks[id];
        const target = getNode(id);
        if (!source) {
          return;
        }
        updateBlock(
          id,
          {
            x: source.x + deltaX / viewport.zoom,
            y: source.y + deltaY / viewport.zoom
          },
          { skipHistory: index > 0 }
        );
        if (target) {
          target.style.transform = "";
        }
      });
    };

    const startResize = (direction: ResizeDirection, event: React.PointerEvent) => {
      const origin = { ...block };
      const min = getMinBlockSize(block.type);
      const aspectRatio = getLockedAspectRatio(block, origin);

      resize(event, {
        onMove: (deltaX, deltaY, moveEvent) => {
          const target = nodeRef.current;
          if (!target) {
            return;
          }
          const rect = computeResizeRect(
            origin,
            direction,
            deltaX / viewport.zoom,
            deltaY / viewport.zoom,
            min,
            aspectRatio,
            moveEvent.shiftKey
          );

          target.style.width = `${rect.width}px`;
          target.style.height = `${rect.height}px`;
          target.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
        },
        onEnd: (deltaX, deltaY, upEvent) => {
          const target = nodeRef.current;
          if (!target) {
            return;
          }
          const rect = computeResizeRect(
            origin,
            direction,
            deltaX / viewport.zoom,
            deltaY / viewport.zoom,
            min,
            aspectRatio,
            upEvent.shiftKey
          );

          target.style.width = "";
          target.style.height = "";
          target.style.transform = "";
          updateBlock(block.id, rect);
        }
      });
    };

    return (
      <div
        ref={(node) => {
          nodeRef.current = node;
          registerNode(block.id, node);
        }}
        className={clsx("block-shell", selected && "selected")}
        style={style}
        onPointerDown={(event) => {
          event.stopPropagation();
          const target = event.target as HTMLElement;
          if (target.closest("[data-block-interactive='true']")) {
            return;
          }
          if (event.button !== 0) {
            return;
          }
          selectBlock(block.id, event.shiftKey);
          setSelectionBox(null);
          bringToFront([block.id]);
          setEditingBlockId(null);
          drag(event, {
            onMove: applyDragTransform,
            onEnd: (deltaX, deltaY) => {
              if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
                if (block.type === "note" && selected) {
                  setEditingBlockId(block.id);
                }
                return;
              }
              commitDrag(deltaX, deltaY, event.altKey);
            }
          });
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          selectBlock(block.id, event.shiftKey);
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            blockIds: selectionIds.includes(block.id) ? selectionIds : [block.id]
          });
        }}
      >
        <div className="block-inner">{children}</div>
        {handles.map((handle) => (
          <div
            key={handle}
            className={`resize-handle ${handle}`}
            onPointerDown={(event) => startResize(handle, event)}
          />
        ))}
      </div>
    );
  }
);

export default BlockShell;
