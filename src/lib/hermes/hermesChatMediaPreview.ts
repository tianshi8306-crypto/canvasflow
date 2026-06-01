import type { HermesToolId } from "@/lib/hermes/hermesDirectorTypes";

export type HermesChatMediaPreview = {
  kind: "image" | "video" | "audio";
  assetRelPath: string;
  nodeId?: string;
  label?: string;
};

const ASSET_PATH_RE = /(?:^|[\s：:])((?:assets\/)[^\s（）]+)/;

const MEDIA_TOOL_IDS = new Set<HermesToolId>([
  "compose.export_script",
  "image.generate_for_beats",
  "image.retry_failed",
  "video.generate_for_beats",
  "video.retry_failed",
]);

export function resolveHermesChatMediaPreview(opts: {
  toolId?: HermesToolId;
  ok: boolean;
  message: string;
  explicit?: HermesChatMediaPreview | null;
}): HermesChatMediaPreview | undefined {
  if (!opts.ok) return undefined;
  if (opts.explicit?.assetRelPath) return opts.explicit;

  if (opts.toolId && !MEDIA_TOOL_IDS.has(opts.toolId)) return undefined;

  const match = opts.message.match(ASSET_PATH_RE);
  if (!match?.[1]) return undefined;

  const assetRelPath = match[1].replace(/[,.;]$/, "");
  const lower = assetRelPath.toLowerCase();
  const kind = /\.(mp4|mov|webm|mkv)$/.test(lower)
    ? "video"
    : /\.(mp3|wav|aac|m4a|ogg)$/.test(lower)
      ? "audio"
      : "image";

  return { kind, assetRelPath };
}

export function hermesChatMediaPreviewLabel(preview: HermesChatMediaPreview): string {
  if (preview.label) return preview.label;
  switch (preview.kind) {
    case "video":
      return "视频预览";
    case "audio":
      return "音频预览";
    default:
      return "图片预览";
  }
}
