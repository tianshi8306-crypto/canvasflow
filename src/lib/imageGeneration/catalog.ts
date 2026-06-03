import { dreaminaCliImageOptions } from "@/lib/dreamina/cliModels";

export type ImageModelOption = {
  id: string;
  label: string;
};

/** 内置默认露出（Seedream API + 即梦 CLI 5.0/4.6；与 settings 预设一致） */
export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { id: "Doubao-Seedream-5.0-lite", label: "Seedream 5.0 Lite" },
  ...dreaminaCliImageOptions(),
];

export type ImageTaskMode = "text_to_image" | "image_to_image" | "multi_ref_fusion" | "image_edit";

export const IMAGE_TASK_OPTIONS: Array<{ id: ImageTaskMode; label: string }> = [
  { id: "text_to_image", label: "文生图" },
  { id: "image_to_image", label: "图生图" },
  { id: "multi_ref_fusion", label: "多图参考融合" },
  { id: "image_edit", label: "图像编辑" },
];

export const IMAGE_ASPECT_OPTIONS = [
  { id: "auto", label: "自适应", ratioW: 16, ratioH: 9 },
  { id: "1:1", label: "1:1", ratioW: 1, ratioH: 1 },
  { id: "9:16", label: "9:16", ratioW: 9, ratioH: 16 },
  { id: "16:9", label: "16:9", ratioW: 16, ratioH: 9 },
  { id: "3:4", label: "3:4", ratioW: 3, ratioH: 4 },
  { id: "4:3", label: "4:3", ratioW: 4, ratioH: 3 },
  { id: "3:2", label: "3:2", ratioW: 3, ratioH: 2 },
  { id: "2:3", label: "2:3", ratioW: 2, ratioH: 3 },
  { id: "4:5", label: "4:5", ratioW: 4, ratioH: 5 },
  { id: "5:4", label: "5:4", ratioW: 5, ratioH: 4 },
  { id: "21:9", label: "21:9", ratioW: 21, ratioH: 9 },
] as const;

export type ImageAspectId = (typeof IMAGE_ASPECT_OPTIONS)[number]["id"];

export const IMAGE_RESOLUTION_TIERS = [
  { id: "1K", label: "1K", shortEdge: 1024 },
  { id: "2K", label: "2K", shortEdge: 2048 },
  { id: "4K", label: "4K", shortEdge: 4096 },
] as const;

export type ImageResolutionTierId = (typeof IMAGE_RESOLUTION_TIERS)[number]["id"];

/** @deprecated 画布已改用 IMAGE_RESOLUTION_TIERS（1K/2K/4K） */
export const IMAGE_RESOLUTION_OPTIONS = IMAGE_RESOLUTION_TIERS.map((t) => ({
  id: t.id,
  label: t.label,
  resLabel: t.label,
}));

/** 图片节点可选生成张数：1×1 / 1×2 / 2×2 宫格 */
export const IMAGE_COUNT_OPTIONS = [
  { id: 1, label: "1张" },
  { id: 2, label: "2张" },
  { id: 4, label: "4张" },
] as const;

export type ImageGenerationCount = (typeof IMAGE_COUNT_OPTIONS)[number]["id"];

const ALLOWED_IMAGE_COUNTS = new Set<number>(IMAGE_COUNT_OPTIONS.map((o) => o.id));

/** 规范化张数（旧工程 imageCount=3 回落为 2） */
export function normalizeImageGenerationCount(raw: unknown): ImageGenerationCount {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 2 || n === 4) return n;
  if (n === 3) return 2;
  return 1;
}

export function isAllowedImageGenerationCount(raw: unknown): raw is ImageGenerationCount {
  return typeof raw === "number" && ALLOWED_IMAGE_COUNTS.has(raw);
}

export type ImageStyleId =
  | "photorealistic"
  | "anime"
  | "oil_painting"
  | "watercolor"
  | "cyberpunk"
  | "fantasy"
  | "illustration"
  | "film_photo"
  | "90s_anime"
  | "guoman"
  | "cinematic"
  | "stop_motion"
  | "cel_style"
  | "archival_photo";

export const IMAGE_STYLE_OPTIONS: Array<{ id: ImageStyleId; label: string }> = [
  { id: "photorealistic", label: "写实摄影" },
  { id: "anime", label: "动漫" },
  { id: "oil_painting", label: "油画" },
  { id: "watercolor", label: "水彩" },
  { id: "cyberpunk", label: "赛博朋克" },
  { id: "fantasy", label: "奇幻" },
  { id: "illustration", label: "插画" },
  { id: "film_photo", label: "胶片摄影" },
  { id: "90s_anime", label: "90s日漫" },
  { id: "guoman", label: "国漫" },
  { id: "cinematic", label: "电影质感" },
  { id: "stop_motion", label: "定格动画" },
  { id: "cel_style", label: "赛璐璐" },
  { id: "archival_photo", label: "复古档案" },
];

/** 各画风的详细英文描述词，生成时追加到 prompt 末尾（Seedream 5.0 Lite 不支持 style_preset API 参数） */
export const IMAGE_STYLE_PROMPTS: Record<ImageStyleId, string> = {
  photorealistic:
    "photorealistic, 8K ultra HD, natural lighting, shallow depth of field, professional photography, sharp focus, accurate texture, natural colors",
  anime:
    "anime style, cel shading, vibrant colors, Japanese animation aesthetic, clean linework, expressive eyes, stylized character design",
  oil_painting:
    "oil painting on canvas, visible brushstrokes, rich texture, classical art technique, museum quality, warm color palette, chiaroscuro lighting",
  watercolor:
    "watercolor painting, soft edges, translucent color layers, delicate bleeding effect, artistic paper texture, gentle atmosphere, minimalist composition",
  cyberpunk:
    "cyberpunk, neon lights, holographic projections, futuristic city at night, chrome reflections, rain-soaked streets, volumetric fog, dystopian atmosphere",
  fantasy:
    "fantasy art, ethereal lighting, mystical atmosphere, enchanted forest, magical creatures, epic composition, digital painting, ornate details",
  illustration:
    "digital illustration, detailed linework, vibrant colors, graphic novel style, clean rendering, comic book aesthetic, bold outlines, dynamic composition",
  film_photo:
    "film photography, grain texture, flash exposure, faded tones, low saturation, cinematic mood, vintage color grading, halation effect, documentary style",
  "90s_anime":
    "90s Japanese anime style, retro anime aesthetic, hand-drawn animation feel, classic VHS quality, nostalgic atmosphere, cel animation look",
  guoman:
    "Chinese comic style, bold linework, vivid colors, manga aesthetic, dynamic composition, xianxia atmosphere, ink wash texture, traditional elements",
  cinematic:
    "cinematic, film-grade cinematography, dramatic lighting, anamorphic lens flare, 2.35:1 widescreen aspect, color grading, film grain, studio quality",
  stop_motion:
    "stop motion animation style, claymation aesthetic, puppetry texture, handcrafted feel, slightly rough edges, frame-by-frame motion, toy-like characters",
  cel_style:
    "cel shading animation, flat colors, clean outlines, 2D cartoon style, vector art aesthetic, bold graphic design, comic panel composition",
  archival_photo:
    "archival photograph, aged photo paper, sepia tones, scratched surface, vintage archive aesthetic, historical document feel, faded ink stamps, nostalgic atmosphere",
};
