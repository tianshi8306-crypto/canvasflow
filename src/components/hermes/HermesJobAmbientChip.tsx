import { useCallback } from "react";
import { useCanvasUiStore } from "@/store/canvasUiStore";

type Props = {
  summary: string;
  failed?: boolean;
  className?: string;
  /** 阻止冒泡到浮窗拖拽层 */
  stopPropagation?: boolean;
};

/** Ambient 任务摘要：点击打开 Job 抽屉 */
export function HermesJobAmbientChip({
  summary,
  failed = false,
  className = "",
  stopPropagation = false,
}: Props) {
  const openHermesJobDrawer = useCanvasUiStore((s) => s.openHermesJobDrawer);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (stopPropagation) e.stopPropagation();
      openHermesJobDrawer();
    },
    [openHermesJobDrawer],
  );

  const onPointerDown = stopPropagation
    ? (e: React.PointerEvent<HTMLButtonElement>) => e.stopPropagation()
    : undefined;

  return (
    <button
      type="button"
      className={`hermesJobAmbientChip${failed ? " hermesJobAmbientChip--failed" : ""}${className ? ` ${className}` : ""}`}
      aria-label={`制片任务：${summary}，点击查看详情`}
      title={summary}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      <span className="hermesJobAmbientChipDot" aria-hidden />
      <span className="hermesJobAmbientChipText">{summary}</span>
    </button>
  );
}
