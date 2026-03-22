import clsx from "clsx";
import { useScarecrowStore } from "../../store";
import {
  ImageIcon,
  NoteIcon,
  PdfIcon,
  SelectIcon,
  VideoIcon
} from "../common/Icons";
import type { Tool } from "../../lib/types";

const buttons: Array<{
  tool: Tool;
  label: string;
  keybind: string;
  icon: JSX.Element;
}> = [
  { tool: "select", label: "Select", keybind: "V", icon: <SelectIcon /> },
  { tool: "note", label: "Note", keybind: "N", icon: <NoteIcon /> },
  { tool: "image", label: "Image", keybind: "I", icon: <ImageIcon /> },
  { tool: "pdf", label: "PDF", keybind: "P", icon: <PdfIcon /> },
  { tool: "video", label: "Video", keybind: "Y", icon: <VideoIcon /> }
];

const Toolbar = () => {
  const activeTool = useScarecrowStore((state) =>
    state.spacePanning ? "hand" : state.activeTool
  );
  const setTool = useScarecrowStore((state) => state.setTool);

  return (
    <aside className="toolbar">
      {buttons.map((button) => (
        <button
          key={button.tool}
          type="button"
          className={clsx("toolbar-button", activeTool === button.tool && "active")}
          title={`${button.label} (${button.keybind})`}
          onClick={() => setTool(button.tool)}
        >
          {button.icon}
        </button>
      ))}
    </aside>
  );
};

export default Toolbar;
