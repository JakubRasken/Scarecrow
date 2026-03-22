import type { SelectionBoxState } from "../../lib/types";

const SelectionBox = ({ box }: { box: SelectionBoxState }) => (
  <div
    className="selection-box"
    style={{
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height
    }}
  />
);

export default SelectionBox;
