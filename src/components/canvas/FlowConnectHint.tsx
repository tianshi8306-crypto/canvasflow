import { createPortal } from "react-dom";
import { useFlowConnectHint } from "@/hooks/canvas/useFlowConnectHint";

/** 连线拖拽时的浮动提示（跟随指针右下方） */
export function FlowConnectHint() {
  const hint = useFlowConnectHint();
  if (!hint || typeof document === "undefined") return null;

  const className =
    hint.valid === true
      ? "flowConnectHint flowConnectHint--valid"
      : hint.valid === false
        ? "flowConnectHint flowConnectHint--invalid"
        : "flowConnectHint";

  return createPortal(
    <div
      className={className}
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: hint.x,
        top: hint.y,
        zIndex: 130,
        pointerEvents: "none",
      }}
    >
      {hint.message}
    </div>,
    document.body,
  );
}
