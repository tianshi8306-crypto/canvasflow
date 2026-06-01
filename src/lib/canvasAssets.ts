import type { AssetSummary } from "@/shared/api/assets";

export const ASSET_LIST_DEFAULT_LIMIT = 200;

export type AssetMediaKind = "video" | "image" | "audio" | "file";

/** 图库/资产列表展示顺序：类型优先级 → 路径稳定字典序 */
const MEDIA_ORDER: Record<string, number> = {
  image: 0,
  video: 1,
  audio: 2,
  file: 3,
};

export type AssetStorageCategory = "gen" | "import" | "export" | "legacy";

export const ASSET_STORAGE_CATEGORY_ORDER: AssetStorageCategory[] = [
  "gen",
  "import",
  "export",
  "legacy",
];

export const ASSET_STORAGE_CATEGORY_LABELS: Record<AssetStorageCategory, string> = {
  gen: "生成素材",
  import: "导入素材",
  export: "导出成品",
  legacy: "历史素材",
};

export const ASSET_MEDIA_KIND_LABELS: Record<AssetMediaKind, string> = {
  video: "视频",
  image: "图片",
  audio: "音频",
  file: "其他",
};

export function assetNodeKindForMediaType(
  mediaType: string,
): "imageNode" | "videoNode" | "audioNode" | null {
  if (mediaType === "image") return "imageNode";
  if (mediaType === "video") return "videoNode";
  if (mediaType === "audio") return "audioNode";
  return null;
}

/** 类型优先目录中的素材 kind（assets/{kind}/...） */
export function assetMediaKind(relPath: string): AssetMediaKind | null {
  const p = relPath.replace(/\\/g, "/").toLowerCase();
  for (const kind of ["video", "image", "audio", "file"] as const) {
    if (p.startsWith(`assets/${kind}/`)) return kind;
  }
  return null;
}

/** 根据 relPath 判断素材在工程内的存储分区 */
export function assetStorageCategory(relPath: string): AssetStorageCategory {
  const p = relPath.replace(/\\/g, "/").toLowerCase();
  if (p.startsWith("assets/export/") || p.startsWith("assets/exports/")) return "export";
  if (p.startsWith("assets/gen/") || p.startsWith("assets/import/")) return "legacy";
  const rest = p.slice("assets/".length);
  if (rest.length > 0 && !rest.includes("/")) return "legacy";
  if (p.includes("/gen/")) return "gen";
  if (p.includes("/import/")) return "import";
  return "legacy";
}

export function sortAssetsForGallery<T extends Pick<AssetSummary, "relPath" | "mediaType">>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ka = assetMediaKind(a.relPath) ?? a.mediaType;
    const kb = assetMediaKind(b.relPath) ?? b.mediaType;
    const oa = MEDIA_ORDER[ka] ?? 50;
    const ob = MEDIA_ORDER[kb] ?? 50;
    if (oa !== ob) return oa - ob;
    return a.relPath.localeCompare(b.relPath, undefined, { sensitivity: "base" });
  });
}

export type AssetGalleryGroup<T extends Pick<AssetSummary, "relPath" | "mediaType">> = {
  category: AssetStorageCategory;
  label: string;
  items: T[];
};

/** 图库分组：gen / import / export / legacy，组内按类型与路径排序 */
export function groupAssetsForGallery<T extends Pick<AssetSummary, "relPath" | "mediaType">>(
  items: T[],
): AssetGalleryGroup<T>[] {
  const buckets = new Map<AssetStorageCategory, T[]>(
    ASSET_STORAGE_CATEGORY_ORDER.map((category) => [category, []]),
  );
  for (const item of items) {
    buckets.get(assetStorageCategory(item.relPath))!.push(item);
  }
  return ASSET_STORAGE_CATEGORY_ORDER.map((category) => ({
    category,
    label: ASSET_STORAGE_CATEGORY_LABELS[category],
    items: sortAssetsForGallery(buckets.get(category) ?? []),
  })).filter((group) => group.items.length > 0);
}
