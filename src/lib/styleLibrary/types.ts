/**
 * styleLibrary/types.ts — 风格库数据模型
 */

/** 单条风格预设（与 public/styleLibrary.json 结构一致） */
export type StylePreset = {
  id: string;
  title: string;
  category: StyleCategory;
  tags: string[];
  hints: string[];
  youmindId: string | null;
  visualStyle: string;
  negativePrompt: string;
  /** 本地封面缩略图路径（如 /style-thumbnails/1402.jpg），无视频条目为 null */
  thumbnailUrl: string | null;
  /** 本地视频路径（如 /style-thumbnails/1402.mp4），无视频条目为 null */
  videoUrl: string | null;
  /** 是否有真实视频预览 */
  hasVideo: boolean;
};

export type StyleCategory = "cinematic" | "anime" | "fantasy" | "ugc" | "ads" | "meme" | "food";

export const STYLE_CATEGORY_META: Record<StyleCategory, { label: string; color: string }> = {
  cinematic: { label: "电影级", color: "#c084fc" },
  anime:     { label: "动漫",   color: "#f472b6" },
  fantasy:   { label: "奇幻",   color: "#38bdf8" },
  ugc:       { label: "UGC",    color: "#4ade80" },
  ads:       { label: "广告",   color: "#fbbf24" },
  meme:      { label: "创意",   color: "#fb923c" },
  food:      { label: "美食",   color: "#f87171" },
};

export function isStyleCategory(s: string): s is StyleCategory {
  return Object.prototype.hasOwnProperty.call(STYLE_CATEGORY_META, s);
}
