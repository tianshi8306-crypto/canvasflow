import { assetNameStem } from "@/lib/seedance/promptBuilder";
import { parseAtReferences, type NamedAsset } from "@/lib/seedance/promptBuilder";
import { IMAGE_STYLE_TOKEN_RE, isImageStyleId } from "@/lib/imageGeneration/imageStyleTokens";
import { IMAGE_STYLE_OPTIONS, type ImageStyleId } from "@/lib/imageGeneration/catalog";
import type { ResolvedIncomingImageRef } from "@/lib/imageGeneration/types";

const MENTION_NODE_RE = /@\[([^\]]+)\]/;

const styleLabelById = Object.fromEntries(
  IMAGE_STYLE_OPTIONS.map((o) => [o.id, o.label]),
) as Record<ImageStyleId, string>;

/** 图片参考条序号 token：@图片N（与视频 VGP 同宽，保证 pill 占位足够） */
export function imageRefAtToken(slot: number): string {
  return `@图片${slot}`;
}

/** 面板序号 token（@图片N / 旧版 @图N） */
export function isImagePanelOrderReferenceToken(fullMatch: string): boolean {
  return /^@图片\d+$/.test(fullMatch) || /^@图\d+$/.test(fullMatch);
}

export type ImageRefAtMeta = {
  slot: number;
  token: string;
  sourceNodeId: string;
  fileName: string;
  stemName: string;
  namedToken?: string;
  stemToken?: string;
  displayToken?: string;
  displayName?: string;
  badge: string;
  label: string;
};

export type ImageRefPickerItem = ImageRefAtMeta & {
  path: string;
  assetId?: string;
  insertToken: string;
  menuTitle: string;
  menuShortcut: string;
};

export type ImagePromptInlineSegment =
  | { kind: "text"; text: string }
  | { kind: "style"; styleId: ImageStyleId; label: string; token: string }
  | { kind: "nodeMention"; nodeId: string; label: string; token: string }
  | { kind: "atRef"; index: number; token: string; label: string }
  | { kind: "atNamed"; name: string; token: string; label: string };

export type ImagePromptInlineSegmentWithMedia = ImagePromptInlineSegment & {
  sourceNodeId?: string;
  path?: string;
  assetId?: string;
};

function uniqueTokens(...tokens: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function refFileName(ref: ResolvedIncomingImageRef): string {
  const path = ref.path ?? ref.resolvedPath ?? "";
  return path.split(/[/\\]/).pop()?.trim() ?? "";
}

export function buildImageRefAtMeta(
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): Map<string, ImageRefAtMeta> {
  const map = new Map<string, ImageRefAtMeta>();
  refs.forEach((ref, i) => {
    const slot = i + 1;
    const fileName = refFileName(ref);
    const stemName = assetNameStem(fileName) || fileName;
    const displayName = nodeLabels[ref.sourceNodeId]?.trim() || undefined;
    const token = imageRefAtToken(slot);
    const namedToken = fileName ? `@${fileName}` : displayName ? `@${displayName}` : undefined;
    const stemToken = stemName && stemName !== fileName ? `@${stemName}` : undefined;
    const displayToken =
      displayName && !uniqueTokens(namedToken, stemToken).includes(`@${displayName}`)
        ? `@${displayName}`
        : undefined;

    map.set(ref.sourceNodeId, {
      slot,
      token,
      sourceNodeId: ref.sourceNodeId,
      fileName,
      stemName,
      namedToken,
      stemToken,
      displayName,
      displayToken,
      badge: String(slot),
      label: `图片${slot}`,
    });
  });
  return map;
}

export function buildImageNamedAssetsFromRefs(
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): NamedAsset[] {
  const out: NamedAsset[] = [];
  const metaMap = buildImageRefAtMeta(refs, nodeLabels);
  for (const ref of refs) {
    const name = refFileName(ref);
    if (!name) continue;
    const aliases: string[] = [];
    const stem = assetNameStem(name);
    if (stem && stem !== name) aliases.push(stem);
    const meta = metaMap.get(ref.sourceNodeId);
    if (meta?.label) aliases.push(meta.label);
    const label = nodeLabels[ref.sourceNodeId]?.trim();
    if (label && label !== name && label !== stem) aliases.push(label);
    out.push({
      name,
      path: ref.resolvedPath ?? ref.path ?? name,
      kind: "image",
      ...(aliases.length > 0 ? { aliases } : {}),
    });
  }
  return out;
}

export function imageRefPickerItems(
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): ImageRefPickerItem[] {
  const map = buildImageRefAtMeta(refs, nodeLabels);
  const out: ImageRefPickerItem[] = [];
  for (const ref of refs) {
    const meta = map.get(ref.sourceNodeId);
    if (!meta) continue;
    out.push({
      ...meta,
      path: ref.path ?? ref.resolvedPath ?? "",
      assetId: ref.assetId,
      insertToken: meta.token,
      menuTitle: `图片 ${meta.slot}`,
      menuShortcut: `(@${meta.slot})`,
    });
  }
  return out;
}

export function resolveCanonicalImageRefInsertToken(
  token: string,
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): string {
  const trimmed = token.trim();
  if (!trimmed.startsWith("@")) return token;
  const metaMap = buildImageRefAtMeta(refs, nodeLabels);
  for (const ref of refs) {
    const meta = metaMap.get(ref.sourceNodeId);
    if (!meta) continue;
    const aliases = uniqueTokens(meta.token, meta.namedToken, meta.stemToken, meta.displayToken);
    if (aliases.includes(trimmed) || trimmed === `@图${meta.slot}`) {
      return meta.token;
    }
  }
  const nodeMatch = /^@\[(.+)\]$/.exec(trimmed);
  if (nodeMatch && metaMap.has(nodeMatch[1])) {
    return metaMap.get(nodeMatch[1])!.token;
  }
  return token;
}

/** blur 时将短别名（@图N、@文件名）规范为 @图片N */
export function normalizeImagePromptRefTokens(
  prompt: string,
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): string {
  const named = buildImageNamedAssetsFromRefs(refs, nodeLabels);
  const atRefs = [...parseAtReferences(prompt, named)].sort((a, b) => b.startIndex - a.startIndex);
  if (atRefs.length === 0) return prompt;

  const metaMap = buildImageRefAtMeta(refs, nodeLabels);
  let next = prompt;

  for (const ref of atRefs) {
    if (isImagePanelOrderReferenceToken(ref.fullMatch)) {
      if (/^@图\d+$/.test(ref.fullMatch)) {
        const slot = parseInt(ref.fullMatch.slice(2), 10);
        const canonical = imageRefAtToken(slot);
        if (canonical !== ref.fullMatch) {
          next = next.slice(0, ref.startIndex) + canonical + next.slice(ref.endIndex);
        }
      }
      continue;
    }
    if (!ref.name?.trim()) continue;

    let canonical: string | undefined;
    for (const item of refs) {
      const meta = metaMap.get(item.sourceNodeId);
      if (!meta) continue;
      const aliases = uniqueTokens(meta.namedToken, meta.stemToken, meta.displayToken);
      const name = ref.name.trim();
      const matched =
        aliases.includes(ref.fullMatch) ||
        name === meta.fileName ||
        name === meta.stemName ||
        (meta.displayName && name === meta.displayName);
      if (matched) {
        canonical = meta.token;
        break;
      }
    }
    if (!canonical || canonical === ref.fullMatch) continue;
    next = next.slice(0, ref.startIndex) + canonical + next.slice(ref.endIndex);
  }

  return next;
}

function findSourceNodeIdForSegment(
  seg: Exclude<ImagePromptInlineSegment, { kind: "text" | "style" }>,
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): string | undefined {
  const metaMap = buildImageRefAtMeta(refs, nodeLabels);
  if (seg.kind === "nodeMention") {
    return metaMap.has(seg.nodeId) ? seg.nodeId : undefined;
  }
  for (const ref of refs) {
    const meta = metaMap.get(ref.sourceNodeId);
    if (!meta) continue;
    const candidates = uniqueTokens(meta.token, meta.namedToken, meta.stemToken, meta.displayToken);
    if (candidates.includes(seg.token)) return ref.sourceNodeId;
  }
  if (seg.kind === "atRef") {
    const ref = refs[seg.index - 1];
    return ref?.sourceNodeId;
  }
  const name = seg.name.trim();
  for (const ref of refs) {
    const meta = metaMap.get(ref.sourceNodeId);
    if (!meta) continue;
    if (name === meta.fileName || name === meta.stemName || (meta.displayName && name === meta.displayName)) {
      return ref.sourceNodeId;
    }
  }
  return undefined;
}

export function enrichImagePromptSegmentsWithMedia(
  segments: ImagePromptInlineSegment[],
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): ImagePromptInlineSegmentWithMedia[] {
  return segments.map((seg) => {
    if (seg.kind === "text" || seg.kind === "style") return seg;
    const sourceNodeId = findSourceNodeIdForSegment(seg, refs, nodeLabels);
    if (!sourceNodeId) return seg;
    const ref = refs.find((r) => r.sourceNodeId === sourceNodeId);
    if (!ref) return seg;
    const meta = buildImageRefAtMeta(refs, nodeLabels).get(sourceNodeId);
    return {
      ...seg,
      sourceNodeId,
      path: ref.path ?? ref.resolvedPath,
      assetId: ref.assetId,
      ...(meta ? { label: meta.label, token: meta.token } : {}),
    };
  });
}

type SegmentMarker = {
  start: number;
  end: number;
  seg: Exclude<ImagePromptInlineSegment, { kind: "text" }>;
};

/** 解析 @ 引用、#[style]、@[nodeId] */
export function parseImagePromptInlineSegments(
  prompt: string,
  refs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): ImagePromptInlineSegment[] {
  const named = buildImageNamedAssetsFromRefs(refs, nodeLabels);
  const atRefs = parseAtReferences(prompt, named);
  const markers: SegmentMarker[] = [];

  for (const ref of atRefs) {
    if (ref.name) {
      markers.push({
        start: ref.startIndex,
        end: ref.endIndex,
        seg: { kind: "atNamed", name: ref.name, token: ref.fullMatch, label: ref.name },
      });
    } else {
      markers.push({
        start: ref.startIndex,
        end: ref.endIndex,
        seg: {
          kind: "atRef",
          index: ref.index,
          token: ref.fullMatch,
          label: `图片${ref.index}`,
        },
      });
    }
  }

  const styleRe = new RegExp(IMAGE_STYLE_TOKEN_RE.source, "g");
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleRe.exec(prompt)) !== null) {
    const styleId = styleMatch[1];
    if (!isImageStyleId(styleId)) continue;
    markers.push({
      start: styleMatch.index,
      end: styleMatch.index + styleMatch[0].length,
      seg: {
        kind: "style",
        styleId,
        label: styleLabelById[styleId] ?? styleId,
        token: styleMatch[0],
      },
    });
  }

  const mentionRe = new RegExp(MENTION_NODE_RE.source, "g");
  let mentionMatch: RegExpExecArray | null;
  while ((mentionMatch = mentionRe.exec(prompt)) !== null) {
    const nodeId = mentionMatch[1];
    markers.push({
      start: mentionMatch.index,
      end: mentionMatch.index + mentionMatch[0].length,
      seg: {
        kind: "nodeMention",
        nodeId,
        label: nodeLabels[nodeId] ?? nodeId,
        token: mentionMatch[0],
      },
    });
  }

  markers.sort((a, b) => a.start - b.start || a.end - b.end);
  const deduped: SegmentMarker[] = [];
  for (const m of markers) {
    if (deduped.some((d) => m.start < d.end && m.end > d.start)) continue;
    deduped.push(m);
  }

  const segments: ImagePromptInlineSegment[] = [];
  let last = 0;
  for (const m of deduped) {
    if (m.start > last) segments.push({ kind: "text", text: prompt.slice(last, m.start) });
    segments.push(m.seg);
    last = m.end;
  }
  if (last < prompt.length) segments.push({ kind: "text", text: prompt.slice(last) });
  return segments;
}

export function findSourceNodeIdAtCursor(
  segments: ImagePromptInlineSegmentWithMedia[],
  cursor: number,
): string | undefined {
  let offset = 0;
  for (const seg of segments) {
    const len =
      seg.kind === "text"
        ? seg.text.length
        : seg.token.length;
    if (seg.kind !== "text" && seg.kind !== "style" && seg.sourceNodeId) {
      if (cursor >= offset && cursor <= offset + len) return seg.sourceNodeId;
    }
    offset += len;
  }
  return undefined;
}

export function promptContainsImageRefToken(
  prompt: string,
  item: ImageRefPickerItem,
): boolean {
  if (prompt.includes(item.insertToken)) return true;
  if (item.namedToken && prompt.includes(item.namedToken)) return true;
  if (item.stemToken && prompt.includes(item.stemToken)) return true;
  if (item.displayToken && prompt.includes(item.displayToken)) return true;
  return false;
}

/** 参考条顺序变化后，将 prompt 内 @图片N / @图N 序号 token 映射到新序号 */
export function remapImagePromptRefOrder(
  prompt: string,
  beforeRefs: ResolvedIncomingImageRef[],
  afterRefs: ResolvedIncomingImageRef[],
  nodeLabels: Record<string, string> = {},
): string {
  const beforeMeta = buildImageRefAtMeta(beforeRefs, nodeLabels);
  const afterMeta = buildImageRefAtMeta(afterRefs, nodeLabels);
  const named = buildImageNamedAssetsFromRefs(beforeRefs, nodeLabels);
  const refs = [...parseAtReferences(prompt, named)].sort((a, b) => b.startIndex - a.startIndex);
  if (refs.length === 0) return prompt;

  let next = prompt;
  for (const ref of refs) {
    if (!isImagePanelOrderReferenceToken(ref.fullMatch)) continue;

    let sourceNodeId: string | undefined;
    for (const item of beforeRefs) {
      const meta = beforeMeta.get(item.sourceNodeId);
      if (!meta) continue;
      if (meta.token === ref.fullMatch || ref.fullMatch === `@图${meta.slot}`) {
        sourceNodeId = item.sourceNodeId;
        break;
      }
    }
    if (!sourceNodeId) continue;
    const newToken = afterMeta.get(sourceNodeId)?.token;
    if (!newToken || newToken === ref.fullMatch) continue;
    next = next.slice(0, ref.startIndex) + newToken + next.slice(ref.endIndex);
  }
  return next;
}
