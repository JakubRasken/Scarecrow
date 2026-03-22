import { useCallback } from "react";

interface DragOptions {
  onMove: (deltaX: number, deltaY: number) => void;
  onEnd: (deltaX: number, deltaY: number, event: PointerEvent) => void;
}

export const useDrag = () =>
  useCallback((event: React.PointerEvent, options: DragOptions) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;

    const handleMove = (moveEvent: PointerEvent) => {
      options.onMove(moveEvent.clientX - startX, moveEvent.clientY - startY);
    };

    const handleUp = (upEvent: PointerEvent) => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      options.onEnd(upEvent.clientX - startX, upEvent.clientY - startY, upEvent);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, []);
