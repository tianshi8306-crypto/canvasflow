import type { PointerEvent as ReactPointerEvent } from "react";

type Props = {
  onResizePointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
};

/** 右下角拉伸（图二）：调整文本节点壳宽高 */
export function TextNodeResizeHandle({ onResizePointerDown }: Props) {
  return (
    <div
      className="textNodeResizeHandle"
      role="separator"
      aria-label="拖动调整节点大小"
      title="拖动调整大小"
      onPointerDown={onResizePointerDown}
    />
  );
}
