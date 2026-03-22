import { useScarecrowStore } from "../../store";
import { NOTE_COLORS } from "../../lib/utils";

const ContextMenu = () => {
  const contextMenu = useScarecrowStore((state) => state.contextMenu);
  const selection = useScarecrowStore((state) => state.selection);
  const blocks = useScarecrowStore((state) => state.blocks);
  const bringToFront = useScarecrowStore((state) => state.bringToFront);
  const sendToBack = useScarecrowStore((state) => state.sendToBack);
  const duplicateSelection = useScarecrowStore((state) => state.duplicateSelection);
  const deleteBlocks = useScarecrowStore((state) => state.deleteBlocks);
  const updateBlock = useScarecrowStore((state) => state.updateBlock);
  const setContextMenu = useScarecrowStore((state) => state.setContextMenu);

  if (!contextMenu) {
    return null;
  }

  const ids = contextMenu.blockIds.length ? contextMenu.blockIds : selection;
  const selectedBlocks = ids.map((id) => blocks[id]).filter(Boolean);
  const noteBlock = selectedBlocks.length === 1 && selectedBlocks[0]?.type === "note"
    ? selectedBlocks[0]
    : null;

  return (
    <div
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="context-item"
        onClick={() => {
          bringToFront(ids);
          setContextMenu(null);
        }}
      >
        Bring to front
      </button>
      <button
        type="button"
        className="context-item"
        onClick={() => {
          sendToBack(ids);
          setContextMenu(null);
        }}
      >
        Send to back
      </button>
      <button
        type="button"
        className="context-item"
        onClick={() => {
          duplicateSelection();
          setContextMenu(null);
        }}
      >
        Duplicate
      </button>
      <button
        type="button"
        className="context-item"
        onClick={() => {
          deleteBlocks(ids);
          setContextMenu(null);
        }}
      >
        Delete
      </button>
      {noteBlock ? (
        <>
          <div className="context-label">Note color</div>
          <div className="swatch-row">
            {NOTE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch"
                style={{ background: color }}
                onClick={() => {
                  updateBlock(noteBlock.id, {
                    content: {
                      ...noteBlock.content,
                      bgColor: color
                    }
                  });
                  setContextMenu(null);
                }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ContextMenu;
