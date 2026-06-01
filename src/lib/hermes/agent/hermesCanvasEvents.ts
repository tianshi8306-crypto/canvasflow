import type { Edge, Node } from "@xyflow/react";
import {
  findPrimaryScriptNode,
} from "@/lib/hermes/hermesCanvasContext";
import { productionFingerprint } from "@/lib/hermes/hermesOrbSuggestions";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import type { ProjectBible } from "@/lib/projectBible/projectBible";
import type { FlowNodeData, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  findImageNodesForScript,
  shotHasGeneratedImage,
  findVideoNodesForScript,
  shotHasGeneratedVideo,
} from "@/lib/storyboard/storyboardMediaNodes";

export type HermesCanvasEventKind =
  | "storyboard_edited"
  | "beats_changed"
  | "selection_focused"
  | "bible_updated"
  | "structure_changed"
  | "production_shift"
  | "brief_updated"
  | "graph_changed";

export type HermesCanvasEvent = {
  id: string;
  kind: HermesCanvasEventKind;
  message: string;
  beatId?: string;
  shotNumber?: string;
  /** iter-102：分镜 visualPrompt 摘要，供风格指代 */
  visualPromptSnippet?: string;
  at: string;
};

export type HermesScriptSnapshot = {
  fingerprint: string;
  beatCount: number;
  shots: Array<{
    beatId: string;
    shotNumber: string;
    status: string;
    visualPrompt: string;
    videoStatus: string;
  }>;
};

const MAX_EVENTS = 14;
const EVENT_TTL_MS = 30 * 60_000;

function shotLabel(shotNumber: string, beatId: string): string {
  const n = shotNumber.trim();
  return n || beatId.slice(0, 6);
}

function shotRow(shot: StoryboardShot, shotNumber: string) {
  return {
    beatId: shot.scriptBeatId,
    shotNumber,
    status: shot.status ?? "",
    visualPrompt: (shot.visualPrompt ?? "").trim(),
    videoStatus: shot.videoStatus ?? "",
  };
}

export function buildScriptSnapshot(nodes: Node<FlowNodeData>[]): HermesScriptSnapshot | null {
  const script = findPrimaryScriptNode(nodes);
  if (!script) return null;
  const beats = normalizeScriptBeats(script.data.scriptBeats);
  const beatNum = new Map(beats.map((b) => [b.id, (b.shotNumber ?? "").trim()]));
  const shots = (script.data.storyboardShots ?? []).map((s) =>
    shotRow(s, beatNum.get(s.scriptBeatId) ?? ""),
  );
  const fingerprint = [
    beats.length,
    ...shots.map(
      (s) =>
        `${s.beatId}:${s.status}:${s.visualPrompt.length}:${s.visualPrompt.slice(0, 48)}:${s.videoStatus}`,
    ),
  ].join("|");
  return { fingerprint, beatCount: beats.length, shots };
}

export function diffScriptSnapshots(
  prev: HermesScriptSnapshot | null,
  next: HermesScriptSnapshot,
): HermesCanvasEvent[] {
  const now = new Date().toISOString();
  const events: HermesCanvasEvent[] = [];

  if (!prev) return events;

  if (prev.beatCount !== next.beatCount) {
    events.push({
      id: `beats-${now}-${next.beatCount}`,
      kind: "beats_changed",
      message:
        next.beatCount > prev.beatCount
          ? `镜头表新增至 ${next.beatCount} 镜`
          : `镜头表调整为 ${next.beatCount} 镜`,
      at: now,
    });
  }

  const prevByBeat = new Map(prev.shots.map((s) => [s.beatId, s]));
  for (const s of next.shots) {
    const old = prevByBeat.get(s.beatId);
    if (!old) continue;
    const vpChanged = old.visualPrompt !== s.visualPrompt;
    const statusChanged = old.status !== s.status;
    if (!vpChanged && !statusChanged) continue;
    const label = shotLabel(s.shotNumber, s.beatId);
    let detail = "分镜已更新";
    if (vpChanged && statusChanged) detail = "分镜文案与状态已更新";
    else if (vpChanged) detail = "分镜 visualPrompt 已修改";
    else if (statusChanged) detail = `分镜状态变为 ${s.status}`;
    events.push({
      id: `sb-${s.beatId}-${Date.now()}`,
      kind: "storyboard_edited",
      message: `镜 ${label}：${detail}`,
      beatId: s.beatId,
      shotNumber: label,
      visualPromptSnippet: s.visualPrompt.slice(0, 160),
      at: now,
    });
  }

  return events;
}

export function selectionFocusEvent(
  nodes: Node<FlowNodeData>[],
  selectedNodeIds: string[],
  prevNodeId: string | null,
): HermesCanvasEvent | null {
  if (selectedNodeIds.length !== 1) return null;
  const nodeId = selectedNodeIds[0]!;
  if (nodeId === prevNodeId) return null;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const script = findPrimaryScriptNode(nodes);
  if (!script) return null;
  const beats = normalizeScriptBeats(script.data.scriptBeats);
  const params = node.data.params;
  const beatId =
    typeof params?.scriptBeatId === "string" ? params.scriptBeatId.trim() : "";
  const beat = beatId ? beats.find((b) => b.id === beatId) : undefined;
  const shotNumber = beat ? shotLabel(beat.shotNumber ?? "", beat.id) : undefined;
  const label = node.data.label?.trim() || node.type || "节点";
  const now = new Date().toISOString();
  return {
    id: `sel-${nodeId}-${Date.now()}`,
    kind: "selection_focused",
    message: shotNumber
      ? `用户选中镜 ${shotNumber}（${label}）`
      : `用户选中：${label}`,
    beatId: beatId || undefined,
    shotNumber,
    at: now,
  };
}

export function bibleChangeEvent(
  prevChars: number,
  nextChars: number,
): HermesCanvasEvent | null {
  if (prevChars === nextChars) return null;
  const now = new Date().toISOString();
  return {
    id: `bible-${now}`,
    kind: "bible_updated",
    message:
      nextChars > prevChars
        ? `项目圣经已更新（${nextChars} 个角色）`
        : `项目圣经角色数变为 ${nextChars}`,
    at: now,
  };
}

const MEDIA_NODE_TYPES = new Set(["imageNode", "imageAsset", "videoNode"]);

export function buildGraphFingerprint(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string {
  const nodeIds = nodes
    .map((n) => n.id)
    .sort()
    .join(",");
  const edgeKeys = edges
    .map((e) => `${e.source}->${e.target}:${e.id}`)
    .sort()
    .join("|");
  return `${nodes.length}:${edges.length}:${nodeIds}:${edgeKeys}`;
}

export function graphStructureEvents(
  prevFp: string | null,
  nextFp: string,
): HermesCanvasEvent[] {
  if (!prevFp || prevFp === nextFp) return [];
  const now = new Date().toISOString();
  return [
    {
      id: `graph-${now}`,
      kind: "graph_changed",
      message: "画布节点或连线结构已变化",
      at: now,
    },
  ];
}

export function buildScriptBriefFingerprint(
  nodes: Node<FlowNodeData>[],
): string | null {
  const script = findPrimaryScriptNode(nodes);
  if (!script) return null;
  const brief = (script.data.prompt ?? "").toString().trim();
  const title = (script.data.label ?? "").toString().trim();
  return `${title}:${brief.slice(0, 120)}`;
}

export function scriptBriefEvents(
  prevFp: string | null,
  nextFp: string | null,
): HermesCanvasEvent[] {
  if (!nextFp || prevFp === nextFp) return [];
  if (!prevFp) return [];
  const now = new Date().toISOString();
  return [
    {
      id: `brief-${now}`,
      kind: "brief_updated",
      message: "脚本梗概或标题已更新",
      at: now,
    },
  ];
}

export function buildMediaFingerprint(nodes: Node<FlowNodeData>[]): string {
  return nodes
    .filter((n) => MEDIA_NODE_TYPES.has(n.type ?? ""))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (n) =>
        `${n.id}:${(n.data.prompt ?? "").trim().slice(0, 48)}:${String(n.data.path ?? "").slice(-32)}`,
    )
    .join("|");
}

export function mediaStructureEvents(
  prevFp: string | null,
  nextFp: string,
  nodes: Node<FlowNodeData>[],
): HermesCanvasEvent[] {
  if (!prevFp || prevFp === nextFp) return [];
  const now = new Date().toISOString();
  const prevById = new Map(
    prevFp.split("|").filter(Boolean).map((row) => {
      const [id, ...rest] = row.split(":");
      return [id!, rest.join(":")] as const;
    }),
  );
  const nextById = new Map(
    nextFp.split("|").filter(Boolean).map((row) => {
      const [id, ...rest] = row.split(":");
      return [id!, rest.join(":")] as const;
    }),
  );
  const events: HermesCanvasEvent[] = [];
  for (const [id, payload] of nextById) {
    if (prevById.get(id) === payload) continue;
    const node = nodes.find((n) => n.id === id);
    const label = node?.data.label?.trim() || node?.type || "媒体节点";
    events.push({
      id: `media-${id}-${Date.now()}`,
      kind: "structure_changed",
      message: `${label} 参数或素材已更新`,
      at: now,
    });
  }
  if (events.length === 0) {
    events.push({
      id: `media-${now}`,
      kind: "structure_changed",
      message: "画布媒体节点已更新",
      at: now,
    });
  }
  return events.slice(0, 4);
}

export function productionShiftEvents(
  prevFp: string | null,
  nextFp: string,
  situationHeadline: string,
): HermesCanvasEvent[] {
  if (!prevFp || prevFp === nextFp) return [];
  const now = new Date().toISOString();
  return [
    {
      id: `prod-${now}`,
      kind: "production_shift",
      message: `制片进度变化：${situationHeadline}`,
      at: now,
    },
  ];
}

export function pruneCanvasEvents(events: HermesCanvasEvent[]): HermesCanvasEvent[] {
  const cutoff = Date.now() - EVENT_TTL_MS;
  const filtered = events.filter((e) => {
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t >= cutoff;
  });
  return filtered.slice(-MAX_EVENTS);
}

export function appendCanvasEvents(
  existing: HermesCanvasEvent[],
  incoming: HermesCanvasEvent[],
): HermesCanvasEvent[] {
  if (incoming.length === 0) return pruneCanvasEvents(existing);
  const merged = [...existing, ...incoming];
  const seen = new Set<string>();
  const deduped: HermesCanvasEvent[] = [];
  for (let i = merged.length - 1; i >= 0; i--) {
    const e = merged[i]!;
    const key = `${e.kind}:${e.beatId ?? ""}:${e.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.unshift(e);
  }
  return pruneCanvasEvents(deduped);
}

export function formatCanvasEventsForPrompt(events: HermesCanvasEvent[]): string {
  if (events.length === 0) return "";
  const recent = events.slice(-8);
  return [
    "近期画布变化（用户手改或选中，规划时请考虑）：",
    ...recent.map((e) => `- ${e.message}`),
  ].join("\n");
}

/** 某镜分镜刚改且已有图 → 建议重新出图 */
export function shotEditedWithImageEvent(
  event: HermesCanvasEvent,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): boolean {
  if (event.kind !== "storyboard_edited" || !event.beatId) return false;
  const script = findPrimaryScriptNode(nodes);
  if (!script) return false;
  const beats = normalizeScriptBeats(script.data.scriptBeats);
  const beat = beats.find((b) => b.id === event.beatId);
  const shot = (script.data.storyboardShots ?? []).find(
    (s) => s.scriptBeatId === event.beatId,
  );
  if (!beat || !shot) return false;
  const imageByBeat = findImageNodesForScript(script.id, nodes, edges);
  const imageNode = nodes.find((n) => n.id === imageByBeat.get(event.beatId!));
  return shotHasGeneratedImage(event.beatId, shot, imageNode);
}

/** 某镜分镜刚改且已有成片视频 → 建议重新出视频 */
export function shotEditedWithVideoEvent(
  event: HermesCanvasEvent,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): boolean {
  if (event.kind !== "storyboard_edited" || !event.beatId) return false;
  const script = findPrimaryScriptNode(nodes);
  if (!script) return false;
  const beats = normalizeScriptBeats(script.data.scriptBeats);
  const beat = beats.find((b) => b.id === event.beatId);
  if (!beat) return false;
  const videoByBeat = findVideoNodesForScript(script.id, nodes, edges);
  const videoNode = nodes.find((n) => n.id === videoByBeat.get(event.beatId!));
  return shotHasGeneratedVideo(videoNode);
}

export function detectCanvasEvents(opts: {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  projectPath: string | null;
  selectedNodeIds: string[];
  bible: ProjectBible | null;
  prevScriptSnapshot: HermesScriptSnapshot | null;
  prevSelectionNodeId: string | null;
  prevBibleCharCount: number;
  prevProductionFp: string | null;
  prevMediaFp: string | null;
  prevGraphFp: string | null;
  prevBriefFp: string | null;
}): { events: HermesCanvasEvent[]; scriptSnapshot: HermesScriptSnapshot | null } {
  const events: HermesCanvasEvent[] = [];
  const nextScript = buildScriptSnapshot(opts.nodes);
  if (nextScript) {
    events.push(...diffScriptSnapshots(opts.prevScriptSnapshot, nextScript));
  }

  const sel = selectionFocusEvent(
    opts.nodes,
    opts.selectedNodeIds,
    opts.prevSelectionNodeId,
  );
  if (sel) events.push(sel);

  const bibleChars = opts.bible?.characters.length ?? 0;
  const bibleEv = bibleChangeEvent(opts.prevBibleCharCount, bibleChars);
  if (bibleEv) events.push(bibleEv);

  const situation = buildHermesSituation(opts.nodes, opts.edges, opts.projectPath, {
    selectedNodeIds: opts.selectedNodeIds,
    bible: opts.bible,
  });
  const fp = productionFingerprint(situation.production);
  events.push(
    ...productionShiftEvents(
      opts.prevProductionFp,
      fp,
      situation.headline,
    ),
  );

  const mediaFp = buildMediaFingerprint(opts.nodes);
  events.push(
    ...mediaStructureEvents(opts.prevMediaFp, mediaFp, opts.nodes),
  );

  const graphFp = buildGraphFingerprint(opts.nodes, opts.edges);
  events.push(...graphStructureEvents(opts.prevGraphFp, graphFp));

  const briefFp = buildScriptBriefFingerprint(opts.nodes);
  events.push(...scriptBriefEvents(opts.prevBriefFp, briefFp));

  return { events, scriptSnapshot: nextScript };
}
