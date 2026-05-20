import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { useProjectStore } from "@/store/projectStore";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { queryKeys } from "@/shared/queryKeys";

type ImageNodeTopToolbarProps = {
  nodeId: string;
  /** 嵌入预览区右上角（无外层浮动 chrome） */
  embedded?: boolean;
};

/** 图片节点操作栏：上传 / 替换图片 */
export function ImageNodeTopToolbar({ nodeId, embedded = false }: ImageNodeTopToolbarProps) {
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);

  const handleUploadImage = useCallback(async () => {
    if (!isTauri()) return;
    const paths = await pickImagePathsForImport(false);
    if (paths?.length) {
      await assignImportedMediaToNode(nodeId, paths);
      if (projectPath) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
      }
    }
  }, [assignImportedMediaToNode, nodeId, projectPath, queryClient]);

  return (
    <div
      className={embedded ? "imageNodeTopToolbar imageNodeTopToolbar--embedded" : "imageNodeTopToolbar"}
      role="toolbar"
      aria-label="上传图片"
    >
      <button
        type="button"
        className="imageNodeTopToolbarBtn"
        title="上传图片"
        aria-label="上传图片"
        onClick={() => void handleUploadImage()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
