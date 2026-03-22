import { useMemo } from "react";
import { useScarecrowStore } from "../store";
import { blockIntersects } from "../lib/utils";

export const useCanvas = (containerRect: DOMRect | null) => {
  const viewport = useScarecrowStore((state) => state.viewport);
  const blocks = useScarecrowStore((state) => state.blocks);
  const currentPageId = useScarecrowStore((state) => state.currentPageId);

  const pageBlocks = useMemo(
    () =>
      Object.values(blocks)
        .filter((block) => block.pageId === currentPageId)
        .sort((a, b) => a.zIndex - b.zIndex),
    [blocks, currentPageId]
  );

  const visibleBlocks = useMemo(() => {
    if (!containerRect) {
      return pageBlocks;
    }
    const buffer = Math.max(600 / viewport.zoom, 360);
    const bounds = {
      left: (-viewport.x) / viewport.zoom - buffer,
      top: (-viewport.y) / viewport.zoom - buffer,
      right: (containerRect.width - viewport.x) / viewport.zoom + buffer,
      bottom: (containerRect.height - viewport.y) / viewport.zoom + buffer
    };
    return pageBlocks.filter((block) => blockIntersects(block, bounds));
  }, [containerRect, pageBlocks, viewport]);

  return {
    viewport,
    pageBlocks,
    visibleBlocks
  };
};
