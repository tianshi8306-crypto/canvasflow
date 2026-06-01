import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  mentionNameFromRelPath,
  parseHermesMentions,
  pinHermesRefAsset,
  type HermesRefAsset,
} from "@/lib/hermes/hermesRefAssets";

export type HermesMentionKind = "image" | "video" | "audio" | "text" | "script" | "pinned";

export type HermesMentionItem = {
  id: string;
  kind: HermesMentionKind;
  insertToken: string;
  menuTitle: string;
  menuShortcut: string;
  relPath?: string;
  assetId?: string;
  nodeId?: string;
  textPreview?: string;
  mediaType?: string;
  aliases: string[];
};

export type HermesResolvedMention = {
  id: string;
  kind: HermesMentionKind;
  label: string;
  token: string;
  relPath?: string;
  assetId?: string;
  nodeId?: string;
  textContent?: string;
  mediaType?: string;
};

const KIND_LABEL: Record<HermesMentionKind, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  text: "文本",
  script: "脚本",
  pinned: "参考",
};

function sortNodes(nodes: Node<FlowNodeData>[]): Node<FlowNodeData>[] {
  return [...nodes].sort((a, b) => {
    const dy = a.position.y - b.position.y;
    if (dy !== 0) return dy;
    return a.position.x - b.position.x;
  });
}

function stemFromPath(path: string): string {
  return mentionNameFromRelPath(path);
}

function mediaKindFromPath(path: string): "image" | "video" | "audio" | null {
  const lower = path.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|heic|avif)$/i.test(lower)) return "image";
  if (/\.(mp4|mov|webm|mkv|m4v)$/i.test(lower)) return "video";
  if (/\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(lower)) return "audio";
  return null;
}

function labelForNode(n: Node<FlowNodeData>): string {
  return n.data.label?.trim() || n.id.slice(0, 8);
}

function textBodyFromNode(n: Node<FlowNodeData>): string {
  const prompt = n.data.prompt?.trim();
  const output = n.data.output?.trim();
  return output || prompt || "";
}

function pushMediaItem(
  out: HermesMentionItem[],
  seenPaths: Set<string>,
  counters: Record<"image" | "video" | "audio", number>,
  opts: {
    kind: "image" | "video" | "audio";
    path?: string;
    assetId?: string;
    nodeId?: string;
    label?: string;
    mediaType?: string;
  },
): void {
  const path = opts.path?.trim();
  const assetId = opts.assetId?.trim();
  if (!path && !assetId) return;
  const key = path || `asset:${assetId}`;
  if (seenPaths.has(key)) return;
  seenPaths.add(key);

  counters[opts.kind] += 1;
  const index = counters[opts.kind];
  const insertToken = `@${opts.kind === "image" ? "图" : opts.kind === "video" ? "视频" : "音频"}${index}`;
  const stem = path ? stemFromPath(path) : "";
  const nodeLabel = opts.label?.trim();
  const aliases: string[] = [];
  if (stem) aliases.push(stem);
  if (nodeLabel && nodeLabel !== stem) aliases.push(nodeLabel);

  out.push({
    id: `media-${opts.kind}-${index}-${opts.nodeId ?? key}`,
    kind: opts.kind,
    insertToken,
    menuTitle: `${KIND_LABEL[opts.kind]} ${index}${nodeLabel ? ` · ${nodeLabel}` : ""}`,
    menuShortcut: `(@${index})`,
    relPath: path,
    assetId,
    nodeId: opts.nodeId,
    mediaType: opts.mediaType,
    aliases,
  });
}

/** 画布全量可 @ 素材 + 钉选参考（去重路径） */
export function buildHermesMentionCatalog(
  nodes: Node<FlowNodeData>[],
  pinned: HermesRefAsset[] = [],
): HermesMentionItem[] {
  const out: HermesMentionItem[] = [];
  const seenPaths = new Set<string>();
  const counters = { image: 0, video: 0, audio: 0, text: 0, script: 0 };

  for (const n of sortNodes(nodes)) {
    const type = n.type ?? "";
    const path = n.data.path?.trim();
    const assetId = n.data.assetId?.trim();
    const label = labelForNode(n);

    if (type === "imageNode" || type === "imageAsset") {
      pushMediaItem(out, seenPaths, counters, {
        kind: "image",
        path,
        assetId,
        nodeId: n.id,
        label,
        mediaType: "image",
      });
      continue;
    }

    if (type === "videoNode" || type === "ffmpegConcat") {
      const videoPath = path || n.data.output?.trim();
      pushMediaItem(out, seenPaths, counters, {
        kind: "video",
        path: videoPath,
        assetId,
        nodeId: n.id,
        label,
        mediaType: "video",
      });
      continue;
    }

    if (type === "audioNode") {
      pushMediaItem(out, seenPaths, counters, {
        kind: "audio",
        path,
        assetId,
        nodeId: n.id,
        label,
        mediaType: "audio",
      });
      continue;
    }

    if (type === "mediaImport") {
      const kind = path ? mediaKindFromPath(path) : null;
      if (kind === "image" || kind === "video" || kind === "audio") {
        pushMediaItem(out, seenPaths, counters, {
          kind,
          path,
          assetId,
          nodeId: n.id,
          label,
        });
      }
      continue;
    }

    if (type === "textNode" || type === "llm") {
      const body = textBodyFromNode(n);
      if (!body) continue;
      counters.text += 1;
      const index = counters.text;
      const insertToken = `@文本${index}`;
      const aliases = [label];
      if (label !== insertToken.slice(1)) aliases.push(insertToken.slice(1));
      out.push({
        id: `text-${n.id}`,
        kind: "text",
        insertToken,
        menuTitle: `${KIND_LABEL.text} ${index} · ${label}`,
        menuShortcut: `(@${index})`,
        nodeId: n.id,
        textPreview: body.slice(0, 240),
        aliases: [...new Set(aliases.filter(Boolean))],
      });
      continue;
    }

    if (type === "scriptNode") {
      const beats = n.data.scriptBeats?.length ?? 0;
      counters.script += 1;
      const index = counters.script;
      const insertToken = `@脚本${index}`;
      const preview =
        beats > 0
          ? `${beats} 个镜头 · ${label}`
          : label;
      out.push({
        id: `script-${n.id}`,
        kind: "script",
        insertToken,
        menuTitle: `${KIND_LABEL.script} ${index} · ${label}`,
        menuShortcut: `(@${index})`,
        nodeId: n.id,
        textPreview: preview,
        aliases: [label, insertToken.slice(1)],
      });
    }
  }

  for (const pin of pinned) {
    const rel = pin.relPath.trim();
    if (rel && seenPaths.has(rel)) continue;
    if (rel) seenPaths.add(rel);
    const mt = pin.mediaType.toLowerCase();
    const kind: HermesMentionKind = mt.includes("video")
      ? "video"
      : mt.includes("audio")
        ? "audio"
        : mt.includes("image") || /\.(png|jpe?g|webp|gif)$/i.test(rel)
          ? "image"
          : "pinned";
    out.push({
      id: `pin-${pin.pinId}`,
      kind,
      insertToken: `@${pin.mentionName}`,
      menuTitle: `${KIND_LABEL.pinned} · ${pin.mentionName}`,
      menuShortcut: `(@${pin.mentionName})`,
      relPath: rel || undefined,
      assetId: pin.assetId,
      mediaType: pin.mediaType,
      aliases: [pin.mentionName, stemFromPath(rel)],
    });
  }

  return out;
}

export function filterHermesMentionCatalog(
  items: HermesMentionItem[],
  query: string,
): HermesMentionItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (it) =>
      it.menuTitle.toLowerCase().includes(q) ||
      it.menuShortcut.toLowerCase().includes(q) ||
      it.insertToken.toLowerCase().includes(q) ||
      it.aliases.some((a) => a.toLowerCase().includes(q)) ||
      (it.relPath?.toLowerCase().includes(q) ?? false) ||
      (it.textPreview?.toLowerCase().includes(q) ?? false),
  );
}

function tokenMatchesItem(token: string, item: HermesMentionItem): boolean {
  const t = token.trim();
  if (!t) return false;
  const at = `@${t}`;
  if (item.insertToken === at || item.insertToken.slice(1) === t) return true;
  const lower = t.toLowerCase();
  return item.aliases.some((a) => a.toLowerCase() === lower);
}

/** 将输入中的 @ 名解析为画布/钉选素材 */
export function resolveHermesMentionsFromCatalog(
  text: string,
  catalog: HermesMentionItem[],
): HermesResolvedMention[] {
  const tokens = parseHermesMentions(text);
  if (tokens.length === 0) return [];
  const out: HermesResolvedMention[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const hit = catalog.find((it) => tokenMatchesItem(token, it));
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push({
      id: hit.id,
      kind: hit.kind,
      label: hit.menuTitle,
      token: hit.insertToken,
      relPath: hit.relPath,
      assetId: hit.assetId,
      nodeId: hit.nodeId,
      textContent: hit.textPreview,
      mediaType: hit.mediaType,
    });
  }
  return out;
}

export function formatHermesMentionsForLlm(mentions: HermesResolvedMention[]): string {
  if (mentions.length === 0) return "";
  const lines = mentions.map((m) => {
    if (m.kind === "text" || m.kind === "script") {
      const body = m.textContent?.trim() || "";
      return `- ${m.token} ${m.label}${body ? `：${body.slice(0, 400)}` : ""}`;
    }
    if (m.relPath) {
      return `- ${m.token}（${m.relPath}）`;
    }
    return `- ${m.token} ${m.label}`;
  });
  return `\n\n[Hermes @ 引用素材]\n${lines.join("\n")}`;
}

export function imageRefPathsFromMentions(mentions: HermesResolvedMention[]): string[] {
  return mentions
    .filter((m) => {
      if (m.kind === "image" || m.kind === "pinned") {
        const mt = m.mediaType?.toLowerCase() ?? "";
        if (mt.includes("image")) return true;
        return m.relPath ? /\.(png|jpe?g|webp|gif|bmp)$/i.test(m.relPath) : false;
      }
      return false;
    })
    .map((m) => m.relPath?.trim())
    .filter((p): p is string => Boolean(p));
}

export type HermesMentionInlineSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; token: string; label: string };

export function parseHermesMentionInlineSegments(
  text: string,
  catalog: HermesMentionItem[],
): HermesMentionInlineSegment[] {
  const segments: HermesMentionInlineSegment[] = [];
  const re = /@([\w\u4e00-\u9fff][\w\u4e00-\u9fff.-]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const full = m[0]!;
    const name = m[1]!;
    if (start > last) {
      segments.push({ kind: "text", text: text.slice(last, start) });
    }
    const hit = catalog.find((it) => tokenMatchesItem(name, it));
    segments.push({
      kind: "mention",
      token: full,
      label: hit ? hit.menuTitle.split(" · ")[0] ?? name : name,
    });
    last = start + full.length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", text: text.slice(last) });
  }
  return segments;
}

export function promptContainsHermesMention(prompt: string, item: HermesMentionItem): boolean {
  if (prompt.includes(item.insertToken)) return true;
  return item.aliases.some((a) => prompt.includes(`@${a}`));
}

function mediaTypeForMentionItem(item: HermesMentionItem): string {
  const mt = item.mediaType?.trim();
  if (mt) return mt;
  const path = item.relPath?.toLowerCase() ?? "";
  if (item.kind === "image") return "image";
  if (item.kind === "video") return "video";
  if (item.kind === "audio") return "audio";
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(path)) return "image";
  if (/\.(mp4|mov|webm|mkv)$/i.test(path)) return "video";
  if (/\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(path)) return "audio";
  return "unknown";
}

/** @ 浮层/输入使用的钉选展示名（与 insertToken 一致，如 图1） */
export function mentionPinNameFromItem(item: HermesMentionItem): string {
  const raw = item.insertToken.startsWith("@")
    ? item.insertToken.slice(1)
    : item.insertToken;
  if (item.kind === "text" || item.kind === "script") return raw;
  if (/^(图|视频|音频)\d+$/.test(raw)) return raw;
  if (item.relPath) return mentionNameFromRelPath(item.relPath);
  return raw;
}

/** 将画布 @ 素材钉入选中参考条（无 relPath 的文本/脚本节点跳过） */
export function pinHermesMentionToRefStrip(
  projectPath: string | null,
  item: HermesMentionItem,
): HermesRefAsset[] | null {
  const rel = item.relPath?.trim();
  if (!projectPath?.trim() || !rel) return null;
  if (item.kind === "text" || item.kind === "script") return null;
  return pinHermesRefAsset(
    projectPath,
    {
      assetId: item.assetId?.trim() || rel,
      relPath: rel,
      mediaType: mediaTypeForMentionItem(item),
    },
    mentionPinNameFromItem(item),
  );
}

/** 根据当前输入框内所有 @ 引用，补齐参考条钉选 */
export function syncHermesRefStripFromMentionText(
  projectPath: string | null,
  text: string,
  catalog: HermesMentionItem[],
): HermesRefAsset[] | null {
  if (!projectPath?.trim()) return null;
  const resolved = resolveHermesMentionsFromCatalog(text, catalog);
  if (resolved.length === 0) return null;
  let changed = false;
  let list: HermesRefAsset[] | null = null;
  for (const m of resolved) {
    if (!m.relPath?.trim()) continue;
    const item = catalog.find((c) => c.id === m.id);
    if (!item) continue;
    const next = pinHermesMentionToRefStrip(projectPath, item);
    if (next) {
      list = next;
      changed = true;
    }
  }
  return changed ? list : null;
}
