import { useEffect, useState, type RefObject } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface UseTauriDragDropOptions {
  wrapRef: RefObject<HTMLDivElement | null>;
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  importMediaFiles: (paths: string[], pos: { x: number; y: number }) => Promise<void>;
  invalidateProjectAssets?: () => Promise<void>;
  setStatusText: (t: string) => void;
}

export function useTauriDragDrop({
  wrapRef,
  screenToFlowPosition,
  importMediaFiles,
  invalidateProjectAssets,
  setStatusText,
}: UseTauriDragDropOptions) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setDragging(true);
        } else if (payload.type === "leave") {
          setDragging(false);
        } else if (payload.type === "drop") {
          setDragging(false);
          const paths = payload.paths;
          if (paths.length === 0) return;
          void (async () => {
            setDragging(true);
            try {
              const factor = await getCurrentWindow().scaleFactor();
              const logical = new PhysicalPosition(payload.position.x, payload.position.y).toLogical(factor);
              const rect = wrapRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = logical.x - rect.left;
              const y = logical.y - rect.top;
              const pos = screenToFlowPosition({ x, y });
              await importMediaFiles(paths, pos);
              if (invalidateProjectAssets) await invalidateProjectAssets();
            } catch (e) {
              setStatusText(`拖拽导入失败：${e}`);
            } finally {
              setDragging(false);
            }
          })();
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [
    wrapRef,
    screenToFlowPosition,
    importMediaFiles,
    invalidateProjectAssets,
    setStatusText,
  ]);

  return { dragging, setDragging };
}
