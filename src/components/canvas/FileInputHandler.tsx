import type { RefObject } from "react";

interface FileInputHandlerProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  menuAnchorRef: React.MutableRefObject<{ x: number; y: number }>;
  importMediaFiles: (paths: string[], pos: { x: number; y: number }) => Promise<void>;
  invalidateProjectAssets: () => Promise<void>;
  setStatusText: (t: string) => void;
}

export function FileInputHandler({
  fileInputRef,
  screenToFlowPosition,
  menuAnchorRef,
  importMediaFiles,
  invalidateProjectAssets,
  setStatusText,
}: FileInputHandlerProps) {
  return (
    <input
      ref={fileInputRef as unknown as React.LegacyRef<HTMLInputElement>}
      type="file"
      multiple
      style={{ display: "none" }}
      onChange={(ev) => {
        const input = ev.currentTarget;
        const files = Array.from(input.files ?? []);
        const paths = files
          .map((f) => (f as File & { path?: string }).path)
          .filter(Boolean) as string[];
        if (paths.length === 0) {
          input.value = "";
          return;
        }
        const fallbackX = menuAnchorRef.current.x || 220;
        const fallbackY = menuAnchorRef.current.y || 180;
        const pos = screenToFlowPosition({ x: fallbackX, y: fallbackY });
        void (async () => {
          try {
            await importMediaFiles(paths, pos);
            await invalidateProjectAssets();
          } catch (e) {
            setStatusText(`上传导入失败：${e}`);
          } finally {
            input.value = "";
          }
        })();
      }}
    />
  );
}
