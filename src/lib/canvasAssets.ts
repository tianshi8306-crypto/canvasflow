import type { AssetSummary } from "@/shared/api/assets";

export const ASSET_LIST_DEFAULT_LIMIT = 200;

/** 图库/资产列表展示顺序：类型优先级 → 路径稳定字典序 */
const MEDIA_ORDER: Record<string, number> = {
  image: 0,
  video: 1,
  audio: 2,
  file: 3,
};

export function assetNodeKindForMediaType(
  mediaType: string,
): "imageNode" | "videoNode" | "audioNode" | null {
  if (mediaType === "image") return "imageNode";
  if (mediaType === "video") return "videoNode";
  if (mediaType === "audio") return "audioNode";
  return null;
}

export function sortAssetsForGallery<T extends Pick<AssetSummary, "relPath" | "mediaType">>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const oa = MEDIA_ORDER[a.mediaType] ?? 50;
    const ob = MEDIA_ORDER[b.mediaType] ?? 50;
    if (oa !== ob) return oa - ob;
    return a.relPath.localeCompare(b.relPath, undefined, { sensitivity: "base" });
  });
}
