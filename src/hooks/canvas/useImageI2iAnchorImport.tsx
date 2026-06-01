import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { queryKeys } from "@/shared/queryKeys";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

const IMAGE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";

/**
 * 监听左锚点「图生图」：在目标图片节点左侧创建参考图节点。
 * Tauri 走原生选图；浏览器走隐藏 file input。
 */
export function useImageI2iAnchorImport(nodeId: string) {
  const i2iFileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const addReferenceImageNodeLeftOf = useProjectStore((s) => s.addReferenceImageNodeLeftOf);
  const imageI2iTargetNodeId = useCanvasUiStore((s) => s.imageI2iTargetNodeId);
  const setImageI2iTargetNodeId = useCanvasUiStore((s) => s.setImageI2iTargetNodeId);

  const afterRefImport = useCallback(async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
    }
  }, [projectPath, queryClient]);

  const onPickI2IFiles = useCallback(
    async (files: FileList | null) => {
      const list = files ? Array.from(files) : [];
      const paths = list
        .map((f) => (f as File & { path?: string }).path)
        .filter(Boolean) as string[];
      if (paths.length === 0) {
        if (i2iFileRef.current) i2iFileRef.current.value = "";
        return;
      }
      await addReferenceImageNodeLeftOf(nodeId, paths);
      await afterRefImport();
      if (i2iFileRef.current) i2iFileRef.current.value = "";
    },
    [addReferenceImageNodeLeftOf, afterRefImport, nodeId],
  );

  useEffect(() => {
    if (imageI2iTargetNodeId !== nodeId) return;
    setImageI2iTargetNodeId(null);
    void (async () => {
      if (isTauri()) {
        const paths = await pickImagePathsForImport(true);
        if (paths?.length) {
          await addReferenceImageNodeLeftOf(nodeId, paths);
          await afterRefImport();
        }
      } else {
        i2iFileRef.current?.click();
      }
    })();
  }, [
    addReferenceImageNodeLeftOf,
    afterRefImport,
    nodeId,
    imageI2iTargetNodeId,
    setImageI2iTargetNodeId,
  ]);

  const i2iFileInput = (
    <input
      ref={i2iFileRef}
      type="file"
      accept={IMAGE_ACCEPT}
      className="srOnly"
      aria-hidden
      tabIndex={-1}
      onChange={(e) => void onPickI2IFiles(e.target.files)}
    />
  );

  return { i2iFileInput };
}
