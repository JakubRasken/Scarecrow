import { useState } from "react";
import clsx from "clsx";
import { useScarecrowStore } from "../../store";
import { PageIcon } from "../common/Icons";
import type { Page } from "../../lib/types";

const PageTree = ({ pages }: { pages: Page[] }) => {
  const currentPageId = useScarecrowStore((state) => state.currentPageId);
  const setCurrentPage = useScarecrowStore((state) => state.setCurrentPage);
  const renamePage = useScarecrowStore((state) => state.renamePage);
  const deletePage = useScarecrowStore((state) => state.deletePage);
  const setContextMenu = useScarecrowStore((state) => state.setContextMenu);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  return (
    <div className="page-tree">
      {pages.map((page) => (
        <div key={page.id}>
          <button
            type="button"
            className={clsx("page-item", currentPageId === page.id && "active")}
            onClick={() => setCurrentPage(page.id)}
            onDoubleClick={() => {
              setEditingId(page.id);
              setDraftName(page.name);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setCurrentPage(page.id);
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                blockIds: []
              });
            }}
          >
            <PageIcon />
            {editingId === page.id ? (
              <input
                className="page-input"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => {
                  setEditingId(null);
                  if (draftName.trim()) {
                    void renamePage(page.id, draftName.trim());
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setEditingId(null);
                    if (draftName.trim()) {
                      void renamePage(page.id, draftName.trim());
                    }
                  }
                  if (event.key === "Escape") {
                    setEditingId(null);
                  }
                }}
                autoFocus
              />
            ) : (
              <span>{page.name}</span>
            )}
          </button>
        </div>
      ))}
      {pages.length > 1 ? (
        <button
          type="button"
          className="page-item"
          onClick={() => {
            const page = pages.find((item) => item.id === currentPageId);
            if (page) {
              void deletePage(page.id);
            }
          }}
        >
          Delete current page
        </button>
      ) : null}
    </div>
  );
};

export default PageTree;
