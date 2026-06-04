import type { Edge, Node } from "@xyflow/react";
import {
  collectVideoIncomingRefItems,
  resolveOrderedVideoIncomingRefItems,
  type VideoIncomingRefKind,
  type VideoIncomingRefItem,
} from "@/hooks/useVideoIncomingReferenceItems";
import { getScriptBeatIdFromParams, orderedIncomingScriptNodeIds } from "@/lib/incomingScriptBinding";
import type { FlowNodeData } from "@/lib/types";
import {
  assetNameStem,
  isPanelOrderReferenceToken,
  parseAtReferences,
  type AtReferenceKind,
  type NamedAsset,
} from "@/lib/seedance/promptBuilder";
import type { VideoGenerationDraft } from "@/lib/videoNodeTypes";

export type VideoRefAtMeta = {
  kind: VideoIncomingRefKind;
  index: number;
  token: string;
  fileName: string;
  stemName: string;
  namedToken?: string;
  stemToken?: string;
  displayName?: string;
  displayToken?: string;
  badge: string;
  label: string;
};

export type VideoRefAtCandidate = VideoRefAtMeta & {
  edgeId: string;
  insertToken: string;
  dropdownLabel: string;
  dropdownHint?: string;
};

const KIND_MENU_LABEL: Record<VideoIncomingRefKind, string> = {
  image: "图片",
  video: "视频",
  audio: "声音",
  text: "文本",
};

/** 生成参数面板参考条顺序（1-based），与 @图片N / @声音N / @视频N 一致（不含文本上游） */
export type VideoPanelOrderedRef = {
  slot: number;
  kind: AtReferenceKind;
  path: string;
};

/** @ 浮层一行：缩略图 +「图片 N」+ (@N) */
export type VideoRefPickerItem = VideoRefAtMeta & {
  edgeId: string;
  path: string;
  assetId?: string;
  insertToken: string;
  menuTitle: string;
  menuShortcut: string;
};

/** N = 参考条从左到右的序号（与缩略图角标一致） */
const AT_TOKEN_BY_KIND: Record<VideoIncomingRefKind, (slot: number) => string> = {
  image: (slot) => `@图片${slot}`,
  video: (slot) => `@视频${slot}`,
  audio: (slot) => `@声音${slot}`,
  text: (slot) => `@文本${slot}`,
};

const AT_LABEL_BY_KIND: Record<VideoIncomingRefKind, (slot: number) => string> = {
  image: (slot) => `图片${slot}`,
  video: (slot) => `视频${slot}`,
  audio: (slot) => `声音${slot}`,
  text: (slot) => `文本${slot}`,
};

export function videoRefFileName(path: string): string {
  return path.split(/[/\\]/).pop()?.trim() ?? "";
}

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

/** 优先插入：节点标签 > 无扩展名 > 完整文件名 */
export function preferredVideoNameToken(meta: VideoRefAtMeta): string | undefined {
  return meta.displayToken ?? meta.stemToken ?? meta.namedToken;
}

/** 插入/规范化时优先 @图片N，保证 prompt 内 token 宽度足够渲染 pill */
export function resolveCanonicalVideoRefInsertToken(
  token: string,
  items: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): string {
  const trimmed = token.trim();
  if (!trimmed.startsWith("@")) return token;
  const metaMap = buildVideoRefAtMeta(items, displayNamesByEdge);
  for (const it of items) {
    const meta = metaMap.get(it.edgeId);
    if (!meta) continue;
    const aliases = uniqueTokens(meta.namedToken, meta.stemToken, meta.displayToken);
    if (meta.token === trimmed || aliases.includes(trimmed)) {
      return meta.token;
    }
  }
  return token;
}

/**
 * 将 prompt 内短别名（@文件名、@节点名）规范为 @图片N / @视频N / @声音N。
 * 保留 {{Portrait N}} 等 brace token，不改动已有 canonical slot token。
 */
export function normalizeVideoPromptRefTokens(
  prompt: string,
  items: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): string {
  const named = buildVideoNamedAssetsFromIncoming(items, displayNamesByEdge);
  const refs = [...parseAtReferences(prompt, named)].sort((a, b) => b.startIndex - a.startIndex);
  if (refs.length === 0) return prompt;

  const metaMap = buildVideoRefAtMeta(items, displayNamesByEdge);
  let next = prompt;

  for (const ref of refs) {
    if (ref.fullMatch.startsWith("{{")) continue;
    if (isPanelOrderReferenceToken(ref.fullMatch)) continue;
    if (!ref.name?.trim()) continue;

    let canonical: string | undefined;
    for (const it of items) {
      const meta = metaMap.get(it.edgeId);
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

export function buildVideoNamedAssetsFromPaths(
  imagePaths: string[],
  videoPaths: string[],
  audioPaths: string[],
  displayNamesByPath?: Map<string, string>,
): NamedAsset[] {
  const push = (path: string, kind: VideoIncomingRefKind) => {
    if (kind === "text") return;
    const name = videoRefFileName(path);
    if (!name) return;
    const aliases: string[] = [];
    const stem = assetNameStem(name);
    if (stem && stem !== name) aliases.push(stem);
    const label = displayNamesByPath?.get(path)?.trim();
    if (label && label !== name && label !== stem) aliases.push(label);
    out.push({ name, path, kind, aliases: aliases.length ? aliases : undefined });
  };

  const out: NamedAsset[] = [];
  for (const path of imagePaths) push(path, "image");
  for (const path of videoPaths) push(path, "video");
  for (const path of audioPaths) push(path, "audio");
  return out;
}

/** 分镜镜号（如 S03）：支持 script→image→video 链，不仅直连 script→video */
function scriptShotAliasesForVideoNode(
  videoNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string[] {
  const videoNode = nodes.find((n) => n.id === videoNodeId);
  const beatId = videoNode ? getScriptBeatIdFromParams(videoNode.data) : undefined;
  if (!beatId) return [];

  const findBeatShotNumber = (scriptNodeId: string): string | undefined => {
    const script = nodes.find((n) => n.id === scriptNodeId);
    const beat = script?.data.scriptBeats?.find((b) => b.id === beatId);
    return beat?.shotNumber?.trim() || undefined;
  };

  for (const scriptId of orderedIncomingScriptNodeIds(nodes, edges, videoNodeId)) {
    const shotNum = findBeatShotNumber(scriptId);
    if (shotNum) return [shotNum];
  }

  for (const it of collectVideoIncomingRefItems(videoNodeId, nodes, edges)) {
    const edge = edges.find((e) => e.id === it.edgeId);
    const source = nodes.find((n) => n.id === edge?.source);
    if (source?.type !== "imageNode") continue;
    for (const scriptId of orderedIncomingScriptNodeIds(nodes, edges, source.id)) {
      const shotNum = findBeatShotNumber(scriptId);
      if (shotNum) return [shotNum];
    }
  }

  return [];
}

function mergeAliasList(...groups: Array<string[] | undefined>): string[] | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    for (const a of g ?? []) {
      const t = a.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out.length > 0 ? out : undefined;
}

/** 为生成任务构建完整名称表：路径 + 无扩展名 + 源节点标签 + 分镜镜号 */
export function buildNamedAssetsForVideoGeneration(opts: {
  videoNodeId: string;
  draft: Pick<
    VideoGenerationDraft,
    "referenceImagePaths" | "referenceVideoPaths" | "referenceAudioPaths"
  >;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}): NamedAsset[] {
  const { videoNodeId, draft, nodes, edges } = opts;
  const incoming = resolveOrderedVideoIncomingRefItems(videoNodeId, nodes, edges);
  const displayNamesByEdge = new Map<string, string>();
  for (const it of incoming) {
    const edge = edges.find((e) => e.id === it.edgeId);
    const label = nodes.find((n) => n.id === edge?.source)?.data.label?.trim();
    if (label) displayNamesByEdge.set(it.edgeId, label);
  }

  const beatAliases = scriptShotAliasesForVideoNode(videoNodeId, nodes, edges);

  const byPath = new Map<string, NamedAsset>();
  const register = (path: string, kind: VideoIncomingRefKind, extraAliases?: string[]) => {
    if (kind === "text") return;
    const name = videoRefFileName(path);
    if (!name) return;
    const stem = assetNameStem(name);
    const stemAlias = stem && stem !== name ? [stem] : [];
    const existing = byPath.get(path);
    const aliases = mergeAliasList(existing?.aliases, stemAlias, extraAliases);
    byPath.set(path, { name, path, kind, aliases });
  };

  for (const p of draft.referenceImagePaths ?? []) register(p, "image", beatAliases);
  for (const p of draft.referenceVideoPaths ?? []) register(p, "video");
  for (const p of draft.referenceAudioPaths ?? []) register(p, "audio");

  const metaMap = buildVideoRefAtMeta(incoming, displayNamesByEdge);
  for (const it of incoming) {
    const meta = metaMap.get(it.edgeId);
    const label = displayNamesByEdge.get(it.edgeId);
    const labelAliases = label ? [label] : [];
    const slotAlias = meta ? meta.label : undefined;
    const slotAliases = slotAlias ? [slotAlias] : [];
    if (!it.path) continue;
    if (byPath.has(it.path)) {
      const cur = byPath.get(it.path)!;
      byPath.set(it.path, {
        ...cur,
        aliases: mergeAliasList(cur.aliases, labelAliases, slotAliases),
      });
    } else {
      register(it.path, it.kind, mergeAliasList(labelAliases, slotAliases));
    }
  }

  return [...byPath.values()];
}

/** 参考条顺序变化后，将 prompt 内 @图片N / @声音N 等序号 token 映射到新序号 */
export function remapVideoPromptRefOrder(
  prompt: string,
  beforeItems: VideoIncomingRefItem[],
  afterItems: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): string {
  const beforeMeta = buildVideoRefAtMeta(beforeItems, displayNamesByEdge);
  const afterMeta = buildVideoRefAtMeta(afterItems, displayNamesByEdge);
  const named = buildVideoNamedAssetsFromIncoming(beforeItems, displayNamesByEdge);
  const refs = [...parseAtReferences(prompt, named)].sort((a, b) => b.startIndex - a.startIndex);
  if (refs.length === 0) return prompt;

  let next = prompt;
  for (const ref of refs) {
    if (ref.fullMatch.startsWith("{{")) continue;
    if (!isPanelOrderReferenceToken(ref.fullMatch)) continue;

    let edgeId: string | undefined;
    for (const it of beforeItems) {
      const meta = beforeMeta.get(it.edgeId);
      if (meta?.token === ref.fullMatch) {
        edgeId = it.edgeId;
        break;
      }
    }
    if (!edgeId) continue;
    const newToken = afterMeta.get(edgeId)?.token;
    if (!newToken || newToken === ref.fullMatch) continue;
    next = next.slice(0, ref.startIndex) + newToken + next.slice(ref.endIndex);
  }
  return next;
}

export function buildPanelOrderedRefs(
  items: VideoIncomingRefItem[],
): VideoPanelOrderedRef[] {
  return items
    .filter(
      (it): it is VideoIncomingRefItem & { kind: AtReferenceKind } =>
        it.kind !== "text" && Boolean(it.path?.trim()),
    )
    .map((it, i) => ({
      slot: i + 1,
      kind: it.kind,
      path: it.path,
    }));
}

export function buildVideoNamedAssetsFromIncoming(
  items: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): NamedAsset[] {
  const out: NamedAsset[] = [];
  for (const it of items) {
    if (it.kind === "text") continue;
    const name = videoRefFileName(it.path);
    if (!name) continue;
    const aliases: string[] = [];
    const stem = assetNameStem(name);
    if (stem && stem !== name) aliases.push(stem);
    const label = displayNamesByEdge?.get(it.edgeId)?.trim();
    if (label && label !== name && label !== stem) aliases.push(label);
    out.push({
      name,
      path: it.path,
      kind: it.kind,
      ...(aliases.length > 0 ? { aliases } : {}),
    });
  }
  return out;
}

export function buildVideoRefAtMeta(
  items: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): Map<string, VideoRefAtMeta> {
  const map = new Map<string, VideoRefAtMeta>();

  items.forEach((it, i) => {
    const slot = i + 1;
    const fileName = videoRefFileName(it.path);
    const stemName = assetNameStem(fileName) || fileName;
    const displayName = (displayNamesByEdge?.get(it.edgeId)?.trim() || it.nodeLabel?.trim()) || undefined;
    const token = AT_TOKEN_BY_KIND[it.kind](slot);
    const namedToken = fileName ? `@${fileName}` : displayName ? `@${displayName}` : undefined;
    const stemToken = stemName && stemName !== fileName ? `@${stemName}` : undefined;
    const displayToken =
      displayName && !uniqueTokens(namedToken, stemToken).includes(`@${displayName}`)
        ? `@${displayName}`
        : undefined;

    map.set(it.edgeId, {
      kind: it.kind,
      index: slot,
      token,
      fileName,
      stemName,
      namedToken,
      stemToken,
      displayName: displayName || undefined,
      displayToken,
      badge: String(slot),
      label: AT_LABEL_BY_KIND[it.kind](slot),
    });
  });
  return map;
}

export function getVideoRefAtMeta(
  items: VideoIncomingRefItem[],
  edgeId: string,
  displayNamesByEdge?: Map<string, string>,
): VideoRefAtMeta | undefined {
  return buildVideoRefAtMeta(items, displayNamesByEdge).get(edgeId);
}

export type VideoPromptInlineSegment =
  | { kind: "text"; text: string }
  | { kind: "atRef"; refKind: AtReferenceKind; index: number; token: string; label: string }
  | { kind: "atTextRef"; slot: number; token: string; label: string }
  | { kind: "atNamed"; name: string; token: string; label: string };

export type VideoPromptInlineSegmentWithMedia = VideoPromptInlineSegment & {
  edgeId?: string;
  path?: string;
  assetId?: string;
  mediaKind?: VideoIncomingRefKind;
};

function atKindToIncomingKind(kind: AtReferenceKind): VideoIncomingRefKind {
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  return "image";
}

/** 按 @ 索引（同 kind 内 1-based）查找 edgeId */
export function findEdgeIdByKindIndex(
  items: VideoIncomingRefItem[],
  kind: VideoIncomingRefKind,
  index: number,
): string | undefined {
  let n = 0;
  for (const it of items) {
    if (it.kind !== kind) continue;
    n += 1;
    if (n === index) return it.edgeId;
  }
  return undefined;
}

/** 将 prompt 内 @ 片段解析为连线 edgeId（优先 token 精确匹配） */
export function findEdgeIdForPromptSegment(
  seg: Exclude<VideoPromptInlineSegment, { kind: "text" }>,
  items: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): string | undefined {
  if (seg.kind === "atTextRef") {
    const item = items[seg.slot - 1];
    return item?.kind === "text" ? item.edgeId : undefined;
  }
  const metaMap = buildVideoRefAtMeta(items, displayNamesByEdge);
  for (const it of items) {
    const meta = metaMap.get(it.edgeId);
    if (!meta) continue;
    const candidates = uniqueTokens(
      meta.token,
      meta.namedToken,
      meta.stemToken,
      meta.displayToken,
    );
    if (candidates.includes(seg.token)) return it.edgeId;
  }
  if (seg.kind === "atRef") {
    return findEdgeIdByKindIndex(items, atKindToIncomingKind(seg.refKind), seg.index);
  }
  const name = seg.name.trim();
  for (const it of items) {
    const fileName = videoRefFileName(it.path);
    const stem = assetNameStem(fileName);
    const label = displayNamesByEdge?.get(it.edgeId)?.trim();
    if (name === fileName || name === stem || (label && name === label)) return it.edgeId;
  }
  return undefined;
}

export function enrichVideoPromptSegmentsWithMedia(
  segments: VideoPromptInlineSegment[],
  items: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): VideoPromptInlineSegmentWithMedia[] {
  return segments.map((seg) => {
    if (seg.kind === "text") return seg;
    const edgeId = findEdgeIdForPromptSegment(seg, items, displayNamesByEdge);
    if (!edgeId) return seg;
    const item = items.find((i) => i.edgeId === edgeId);
    if (!item) return seg;
    return {
      ...seg,
      edgeId,
      path: item.path,
      assetId: item.assetId,
      mediaKind: item.kind,
    };
  });
}

export function parseVideoPromptInlineSegments(
  prompt: string,
  namedAssets?: NamedAsset[],
): VideoPromptInlineSegment[] {
  const markers: Array<{ start: number; end: number; seg: Exclude<VideoPromptInlineSegment, { kind: "text" }> }> =
    [];

  const textPanelRe = /@文本(\d+)/g;
  let textPanelMatch: RegExpExecArray | null;
  while ((textPanelMatch = textPanelRe.exec(prompt)) !== null) {
    const slot = parseInt(textPanelMatch[1], 10);
    if (!Number.isFinite(slot) || slot < 1) continue;
    markers.push({
      start: textPanelMatch.index,
      end: textPanelMatch.index + textPanelMatch[0].length,
      seg: {
        kind: "atTextRef",
        slot,
        token: textPanelMatch[0],
        label: `文本${slot}`,
      },
    });
  }

  const refs = [...parseAtReferences(prompt, namedAssets)].sort((a, b) => a.startIndex - b.startIndex);

  for (const ref of refs) {
    const overlaps = markers.some((m) => ref.startIndex < m.end && ref.endIndex > m.start);
    if (overlaps) continue;
    if (ref.name) {
      markers.push({
        start: ref.startIndex,
        end: ref.endIndex,
        seg: {
          kind: "atNamed",
          name: ref.name,
          token: ref.fullMatch,
          label: ref.name,
        },
      });
    } else {
      const label =
        ref.kind === "image"
          ? `图片${ref.index}`
          : ref.kind === "video"
            ? `视频${ref.index}`
            : `声音${ref.index}`;
      markers.push({
        start: ref.startIndex,
        end: ref.endIndex,
        seg: {
          kind: "atRef",
          refKind: ref.kind,
          index: ref.index,
          token: ref.fullMatch,
          label,
        },
      });
    }
  }

  markers.sort((a, b) => a.start - b.start || a.end - b.end);
  const deduped: typeof markers = [];
  for (const m of markers) {
    if (deduped.some((d) => m.start < d.end && m.end > d.start)) continue;
    deduped.push(m);
  }

  const segments: VideoPromptInlineSegment[] = [];
  let last = 0;
  for (const m of deduped) {
    if (m.start > last) segments.push({ kind: "text", text: prompt.slice(last, m.start) });
    segments.push(m.seg);
    last = m.end;
  }

  if (last < prompt.length) {
    segments.push({ kind: "text", text: prompt.slice(last) });
  }
  return segments;
}

function pushNameCandidate(
  out: VideoRefAtCandidate[],
  meta: VideoRefAtMeta,
  edgeId: string,
  insertToken: string,
  dropdownLabel: string,
  dropdownHint?: string,
) {
  if (out.some((c) => c.insertToken === insertToken)) return;
  out.push({
    ...meta,
    edgeId,
    insertToken,
    dropdownLabel,
    dropdownHint,
  });
}

/** @ 浮层列表（每路连线素材一行，默认插入 @图片N / @声音N / @视频N） */
export function videoRefPickerItems(
  items: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): VideoRefPickerItem[] {
  const map = buildVideoRefAtMeta(items, displayNamesByEdge);
  const out: VideoRefPickerItem[] = [];
  for (const it of items) {
    const meta = map.get(it.edgeId);
    if (!meta) continue;
    const menuTitle = `${KIND_MENU_LABEL[meta.kind]} ${meta.index}`;
    const menuShortcut = `(@${meta.index})`;
    out.push({
      ...meta,
      edgeId: it.edgeId,
      path: it.path,
      assetId: it.assetId,
      insertToken: meta.token,
      menuTitle,
      menuShortcut,
    });
  }
  return out;
}

/** @ 下拉：索引 + 文件名 + 无扩展名 + 源节点标签（多行备选，非浮层主列表） */
export function videoRefAtCandidates(
  items: VideoIncomingRefItem[],
  displayNamesByEdge?: Map<string, string>,
): VideoRefAtCandidate[] {
  const map = buildVideoRefAtMeta(items, displayNamesByEdge);
  const out: VideoRefAtCandidate[] = [];

  for (const it of items) {
    const meta = map.get(it.edgeId);
    if (!meta) continue;

    pushNameCandidate(out, meta, it.edgeId, meta.token, meta.label, meta.fileName || undefined);

    if (meta.displayToken) {
      pushNameCandidate(
        out,
        meta,
        it.edgeId,
        meta.displayToken,
        meta.displayName ?? meta.displayToken.slice(1),
        `${meta.label} · 节点名`,
      );
    }
    if (meta.stemToken) {
      pushNameCandidate(
        out,
        meta,
        it.edgeId,
        meta.stemToken,
        meta.stemName,
        meta.fileName ? `${meta.label} · ${meta.fileName}` : meta.label,
      );
    }
    if (meta.namedToken && meta.namedToken !== meta.stemToken && meta.namedToken !== meta.displayToken) {
      pushNameCandidate(out, meta, it.edgeId, meta.namedToken, meta.fileName, meta.label);
    }
  }
  return out;
}

export function promptHasAtRefs(prompt: string, namedAssets?: NamedAsset[]): boolean {
  const refs = parseAtReferences(prompt, namedAssets);
  return refs.some((r) => (r.name && r.name.length > 0) || r.index > 0);
}

export const promptHasIndexedAtRefs = promptHasAtRefs;
