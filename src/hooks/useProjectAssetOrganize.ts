import { useCallback } from "react";
import { applyAssetPathMappingsToNodes } from "@/lib/applyAssetPathMappings";
import { formatUserError } from "@/lib/errors";
import {
  backfillCanvasAssetIds,
  migrateLegacyAssets,
  syncAssetsIndex,
} from "@/shared/api/assets";
import { useProjectStore } from "@/store/projectStore";

export function useProjectAssetOrganize(onStatus?: (text: string) => void) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const report = onStatus ?? setStatusText;

  const applyMigrationToCanvas = useCallback(
    async (pathMappings: Record<string, string>) => {
      if (!projectPath || Object.keys(pathMappings).length === 0) return;
      const store = useProjectStore.getState();
      let nextNodes = applyAssetPathMappingsToNodes(store.nodes, pathMappings);
      const payloadNodes = nextNodes.filter((n) =>
        ["imageNode", "imageAsset", "videoNode", "audioNode", "mediaImport", "scriptNode"].includes(
          n.type ?? "",
        ),
      );
      if (payloadNodes.length > 0) {
        try {
          const backfill = await backfillCanvasAssetIds(
            projectPath,
            payloadNodes.map((n) => ({
              id: n.id,
              type: n.type ?? "",
              data: n.data as Record<string, unknown>,
            })),
          );
          const patchById = new Map(backfill.nodePatches.map((p) => [p.nodeId, p]));
          nextNodes = nextNodes.map((n) => {
            const patch = patchById.get(n.id);
            if (!patch) return n;
            return { ...n, data: { ...n.data, assetId: patch.assetId, path: patch.relPath } };
          });
        } catch {
          /* optional */
        }
      }
      useProjectStore.setState({ nodes: nextNodes, projectDirty: true });
    },
    [projectPath],
  );

  const syncIndex = useCallback(async () => {
    if (!projectPath) {
      report("请先打开工程");
      return;
    }
    try {
      const n = await syncAssetsIndex(projectPath);
      report(`已同步 ${n} 个文件到素材索引`);
    } catch (e) {
      report(`同步素材索引失败：${formatUserError(e)}`);
    }
  }, [projectPath, report]);

  const previewOrganize = useCallback(async () => {
    if (!projectPath) {
      report("请先打开工程");
      return null;
    }
    try {
      const result = await migrateLegacyAssets(projectPath, true);
      report(
        result.migratedCount === 0
          ? "工程素材目录已规范，无需整理"
          : `预览：可整理 ${result.migratedCount} 个素材到类型子目录`,
      );
      return result;
    } catch (e) {
      report(`预览失败：${formatUserError(e)}`);
      return null;
    }
  }, [projectPath, report]);

  const executeOrganize = useCallback(async () => {
    if (!projectPath) {
      report("请先打开工程");
      return null;
    }
    try {
      const preview = await migrateLegacyAssets(projectPath, true);
      if (preview.migratedCount === 0) {
        report("工程素材目录已规范，无需整理");
        return preview;
      }
      const ok = window.confirm(
        `将整理 ${preview.migratedCount} 个素材到 assets/{类型}/import|gen/ 目录，并更新 canvasflow.json。\n建议先备份工程。是否继续？`,
      );
      if (!ok) return null;

      const result = await migrateLegacyAssets(projectPath, false);
      await applyMigrationToCanvas(result.pathMappings);
      report(
        `已整理 ${result.migratedCount} 个素材，更新 canvasflow.json ${result.canvasPathUpdates} 处`,
      );
      return result;
    } catch (e) {
      report(`整理素材目录失败：${formatUserError(e)}`);
      return null;
    }
  }, [applyMigrationToCanvas, projectPath, report]);

  return {
    projectPath,
    syncIndex,
    previewOrganize,
    executeOrganize,
  };
}
