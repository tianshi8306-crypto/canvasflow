import { invoke } from "@tauri-apps/api/core";

export type AssetSummary = {
  /** 工程内稳定素材 ID（UUID），见 M1 资产层 */
  assetId: string;
  relPath: string;
  mediaType: string;
  source: string | null;
  metaJson: string | null;
  createdAt: string;
};

/** `import_media_files` 单条结果（M1-1.3） */
export type ImportedMediaItem = {
  assetId: string;
  relPath: string;
};

export async function listAssets(projectPath: string, limit = 100): Promise<AssetSummary[]> {
  return invoke<AssetSummary[]>("list_assets", { projectPath, limit });
}

/** 按素材 UUID 查询；不存在返回 `null` */
export async function getAssetById(
  projectPath: string,
  assetId: string,
): Promise<AssetSummary | null> {
  return invoke<AssetSummary | null>("get_asset_by_id", { projectPath, assetId });
}

/** 按工程相对路径（如 `assets/foo.png`）查询；不存在返回 `null` */
export async function getAssetByRelPath(
  projectPath: string,
  relPath: string,
): Promise<AssetSummary | null> {
  return invoke<AssetSummary | null>("get_asset_by_rel_path", { projectPath, relPath });
}

/**
 * 解析预览/调用后端所需的工程相对路径：有 `relPath` 时优先（生成落盘真值），否则按 `assetId` 查库。
 */
export async function resolveAssetRelPath(
  projectPath: string | null | undefined,
  relPath: string | undefined,
  assetId: string | undefined,
): Promise<string | null> {
  const pathNow = relPath?.trim();
  if (pathNow) return pathNow;

  const id = assetId?.trim();
  const root = projectPath?.trim();
  if (id && root) {
    try {
      const { isTauri } = await import("@tauri-apps/api/core");
      if (isTauri()) {
        const a = await getAssetById(root, id);
        if (a?.relPath?.trim()) return a.relPath.trim();
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export async function importMediaFiles(
  projectPath: string,
  filePaths: string[],
): Promise<ImportedMediaItem[]> {
  return invoke<ImportedMediaItem[]>("import_media_files", { projectPath, filePaths });
}

/** 扫描工程 `assets/` 下已有文件并写入素材索引 */
export async function syncAssetsIndex(projectPath: string): Promise<number> {
  return invoke<number>("sync_assets_index", { projectPath });
}

export type AssetMigrationItem = {
  oldRelPath: string;
  newRelPath: string;
  target: string;
  skipped: boolean;
  skipReason?: string;
};

export type AssetMigrationResult = {
  dryRun: boolean;
  migratedCount: number;
  skippedCount: number;
  canvasPathUpdates: number;
  pathMappings: Record<string, string>;
  items: AssetMigrationItem[];
};

/** 将 assets/ 根目录旧扁平文件迁移到 gen/import 分层目录 */
export async function migrateLegacyAssets(
  projectPath: string,
  dryRun = false,
): Promise<AssetMigrationResult> {
  return invoke<AssetMigrationResult>("migrate_legacy_assets", { projectPath, dryRun });
}

/** 打开工程时为仅有 `path` 的媒体节点补 `assetId`（Tauri） */
export type NodeAssetIdPatch = {
  nodeId: string;
  assetId: string;
  relPath: string;
};

export type ScriptNodeAssetPatch = {
  scriptNodeId: string;
  storyboardShots?: StoryboardShotLike[];
  scriptBeats?: Record<string, unknown>[];
};

/** 与 `StoryboardShot` 兼容的回填载荷（JSON 反序列化） */
export type StoryboardShotLike = {
  scriptBeatId: string;
  visualPrompt?: string;
  imagePath?: string;
  imageAssetId?: string;
  [key: string]: unknown;
};

export type CanvasAssetBackfillResult = {
  nodePatches: NodeAssetIdPatch[];
  scriptPatches: ScriptNodeAssetPatch[];
};

export async function backfillCanvasAssetIds(
  projectPath: string,
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>,
): Promise<CanvasAssetBackfillResult> {
  return invoke<CanvasAssetBackfillResult>("backfill_canvas_asset_ids", { projectPath, nodes });
}
