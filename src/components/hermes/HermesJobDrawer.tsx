import { useEffect, useRef } from "react";
import { HermesJobCenter } from "@/components/hermes/HermesJobCenter";
import { useCanvasUiStore } from "@/store/canvasUiStore";

type Props = {
  projectPath: string | null;
};

/** 浮窗/画布 ambient 任务抽屉：不占聊天主栏 */
export function HermesJobDrawer({ projectPath }: Props) {
  const open = useCanvasUiStore((s) => s.hermesJobDrawerOpen);
  const closeHermesJobDrawer = useCanvasUiStore((s) => s.closeHermesJobDrawer);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHermesJobDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHermesJobDrawer, open]);

  if (!open || !projectPath) return null;

  return (
    <>
      <button
        type="button"
        className="hermesJobDrawerBackdrop nopan nodrag nowheel"
        aria-label="关闭任务面板"
        onClick={closeHermesJobDrawer}
      />
      <aside
        ref={panelRef}
        className="hermesJobDrawer nopan nodrag nowheel"
        role="dialog"
        aria-label="Hermes 制片任务"
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <header className="hermesJobDrawerHead">
          <span className="hermesJobDrawerTitle">制片任务</span>
          <button
            type="button"
            className="hermesJobDrawerClose"
            aria-label="关闭"
            onClick={closeHermesJobDrawer}
          >
            ×
          </button>
        </header>
        <div className="hermesJobDrawerBody">
          <HermesJobCenter projectPath={projectPath} variant="drawer" />
        </div>
      </aside>
    </>
  );
}
