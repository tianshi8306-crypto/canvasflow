import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { pickImagePathsForImport } from "@/lib/tauriMediaPaths";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  nodeId: string;
};

/** 无图态：节点上方居中上传入口（对齐参考图一） */
export function ImageNodeEmptyUpload({ nodeId }: Props) {
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);

  const onUpload = useCallback(async () => {
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
    <button
      type="button"
      className="nodeChrome-upload-float minimal-image-upload-float"
      title="上传图片"
      onClick={() => void onUpload()}
      onPointerDown={(e) => e.stopPropagation()}
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
      上传
    </button>
  );
}
