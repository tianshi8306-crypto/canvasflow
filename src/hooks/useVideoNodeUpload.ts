import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { pickVideoPathsForImport } from "@/lib/tauriMediaPaths";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { queryKeys } from "@/shared/queryKeys";
import { useProjectStore } from "@/store/projectStore";

/** 为 videoNode 选择本地视频并导入工程、绑定到节点 */
export function useVideoNodeUpload(nodeId: string) {
  const queryClient = useQueryClient();
  const projectPath = useProjectStore((s) => s.projectPath);
  const assignImportedMediaToNode = useProjectStore((s) => s.assignImportedMediaToNode);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const uploadVideo = useCallback(async (): Promise<boolean> => {
    if (!isTauri()) {
      setStatusText(DESKTOP_SHELL_HINT);
      return false;
    }
    if (!projectPath?.trim()) {
      setStatusText("请先新建或打开工程目录后再上传视频。");
      return false;
    }
    const paths = await pickVideoPathsForImport(false);
    if (!paths?.length) return false;
    await assignImportedMediaToNode(nodeId, paths);
    await queryClient.invalidateQueries({ queryKey: queryKeys.assets.list(projectPath) });
    return true;
  }, [assignImportedMediaToNode, nodeId, projectPath, queryClient, setStatusText]);

  return { uploadVideo };
}
