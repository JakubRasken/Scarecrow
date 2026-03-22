import { useMemo, useState } from "react";
import clsx from "clsx";
import { useScarecrowStore } from "../../store";
import PageTree from "./PageTree";
import { ChevronLeftIcon, PlusIcon } from "../common/Icons";

const WorkspacePanel = () => {
  const sidebarCollapsed = useScarecrowStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useScarecrowStore((state) => state.toggleSidebar);
  const currentWorkspaceId = useScarecrowStore((state) => state.currentWorkspaceId);
  const workspaces = useScarecrowStore((state) => state.workspaces);
  const pages = useScarecrowStore((state) => state.pages);
  const renameWorkspace = useScarecrowStore((state) => state.renameWorkspace);
  const createPage = useScarecrowStore((state) => state.createPage);
  const [draft, setDraft] = useState("");

  const workspace = workspaces.find((item) => item.id === currentWorkspaceId) ?? null;
  const workspacePages = useMemo(
    () => pages.filter((page) => page.workspaceId === currentWorkspaceId),
    [currentWorkspaceId, pages]
  );

  return (
    <aside className={clsx("workspace-panel", sidebarCollapsed && "collapsed")}>
      <div className="workspace-header">
        <button type="button" className="sidebar-toggle" onClick={toggleSidebar}>
          <ChevronLeftIcon />
        </button>
        <div className="workspace-title-row">
          <input
            className="workspace-input"
            value={draft || workspace?.name || ""}
            onFocus={() => setDraft(workspace?.name ?? "")}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (workspace && draft.trim()) {
                void renameWorkspace(workspace.id, draft.trim());
              }
              setDraft("");
            }}
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => void createPage(currentWorkspaceId ?? undefined, "Canvas")}
          >
            <PlusIcon />
          </button>
        </div>
      </div>
      <PageTree pages={workspacePages} />
    </aside>
  );
};

export default WorkspacePanel;
