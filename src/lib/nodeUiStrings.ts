import { fileBasename } from "@/lib/paths";

/** 图 / 视频 / 音频素材节点无 path 时的统一副标题（R2 空态可读性） */
export const NODE_EMPTY_MEDIA_SUBTITLE = "未绑定素材；可上传或拖入工程";

/** 文本节点尚无正文时的副标题 */
export const NODE_EMPTY_TEXT_SUBTITLE = "尚无正文；双击卡片或选中后编辑";

/** 脚本节点尚无镜头条目时的副标题 */
export const NODE_EMPTY_SCRIPT_SUBTITLE = "尚无脚本镜头；可写梗概或使用生成";

export function mediaAssetNodeSubtitle(
  hasPath: boolean,
  path: string | undefined,
  assetId: string | undefined,
): string | undefined {
  if (!hasPath) return NODE_EMPTY_MEDIA_SUBTITLE;
  if (path?.trim()) return fileBasename(path);
  if (assetId?.trim()) return `${assetId.trim().slice(0, 8)}…`;
  return undefined;
}

/** 文本节点标题下摘要：空态提示或正文首节。 */
export function textNodeSubtitle(hasBody: boolean, prompt: string | undefined, maxChars = 44): string | undefined {
  const p = (prompt ?? "").trim();
  if (!hasBody || !p) return NODE_EMPTY_TEXT_SUBTITLE;
  const oneLine = p.replace(/\s+/g, " ");
  if (oneLine.length <= maxChars) return oneLine;
  return `${oneLine.slice(0, maxChars)}…`;
}

/** 脚本节点标题下摘要：空态或镜头条数。 */
export function scriptNodeSubtitle(hasBeats: boolean, beatCount: number): string | undefined {
  if (!hasBeats || beatCount <= 0) return NODE_EMPTY_SCRIPT_SUBTITLE;
  return `${beatCount} 条镜头`;
}
