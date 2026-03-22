import { useEffect } from "react";
import { useScarecrowStore } from "../store";
import { isMac } from "../lib/utils";

export const useShortcuts = () => {
  const selection = useScarecrowStore((state) => state.selection);
  const setTool = useScarecrowStore((state) => state.setTool);
  const setSpacePanning = useScarecrowStore((state) => state.setSpacePanning);
  const deleteBlocks = useScarecrowStore((state) => state.deleteBlocks);
  const copySelection = useScarecrowStore((state) => state.copySelection);
  const pasteClipboard = useScarecrowStore((state) => state.pasteClipboard);
  const duplicateSelection = useScarecrowStore((state) => state.duplicateSelection);
  const undo = useScarecrowStore((state) => state.undo);
  const redo = useScarecrowStore((state) => state.redo);
  const selectAllCurrentPage = useScarecrowStore((state) => state.selectAllCurrentPage);
  const clearSelection = useScarecrowStore((state) => state.clearSelection);
  const toggleSidebar = useScarecrowStore((state) => state.toggleSidebar);
  const panBy = useScarecrowStore((state) => state.panBy);
  const requestFitToContent = useScarecrowStore((state) => state.requestFitToContent);
  const setViewport = useScarecrowStore((state) => state.setViewport);
  const editingBlockId = useScarecrowStore((state) => state.editingBlockId);
  const setEditingBlockId = useScarecrowStore((state) => state.setEditingBlockId);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = isMac() ? event.metaKey : event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const editingText =
        target?.closest("input, textarea, [contenteditable='true'], .ProseMirror") !== null;

      if (event.code === "Space") {
        setSpacePanning(true);
        return;
      }

      if (modifier && event.key === "\\") {
        event.preventDefault();
        toggleSidebar();
        return;
      }

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if (modifier && event.key.toLowerCase() === "c" && selection.length && !editingText) {
        event.preventDefault();
        copySelection();
        return;
      }

      if (modifier && event.key.toLowerCase() === "v" && !editingText) {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAllCurrentPage();
        return;
      }

      if (modifier && event.key === "0") {
        event.preventDefault();
        requestFitToContent();
        return;
      }

      if (modifier && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        setViewport((viewport) => ({
          ...viewport,
          zoom: Math.min(4, viewport.zoom * 1.1)
        }));
        return;
      }

      if (modifier && event.key === "-") {
        event.preventDefault();
        setViewport((viewport) => ({
          ...viewport,
          zoom: Math.max(0.1, viewport.zoom / 1.1)
        }));
        return;
      }

      if (!editingText && !editingBlockId) {
        const key = event.key.toLowerCase();
        if (key === "v") {
          setTool("select");
        } else if (key === "n") {
          setTool("note");
        } else if (key === "i") {
          setTool("image");
        } else if (key === "p") {
          setTool("pdf");
        } else if (key === "y") {
          setTool("video");
        }
      }

      if (!selection.length && !editingBlockId) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          panBy(0, 20);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          panBy(0, -20);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          panBy(20, 0);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          panBy(-20, 0);
        }
      }

      if (event.key === "Escape") {
        clearSelection();
        setEditingBlockId(null);
      }

      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        selection.length &&
        !editingText &&
        !editingBlockId
      ) {
        event.preventDefault();
        deleteBlocks(selection);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpacePanning(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    clearSelection,
    copySelection,
    deleteBlocks,
    duplicateSelection,
    editingBlockId,
    panBy,
    pasteClipboard,
    redo,
    requestFitToContent,
    selectAllCurrentPage,
    selection,
    setEditingBlockId,
    setSpacePanning,
    setTool,
    setViewport,
    toggleSidebar,
    undo
  ]);
};
