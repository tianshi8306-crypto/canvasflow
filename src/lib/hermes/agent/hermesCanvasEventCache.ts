import type { HermesCanvasEvent } from "@/lib/hermes/agent/hermesCanvasEvents";
import {
  mergeCanvasReferent,
  pickLatestReferentFromEvents,
} from "@/lib/hermes/agent/hermesCanvasReferent";
import {
  buildStyleAnchorFromScriptBeat,
  buildStyleAnchorFromVideoBeat,
  mergeStyleAnchor,
  pickLatestStyleAnchorFromEvents,
  type HermesStyleAnchor,
} from "@/lib/hermes/agent/hermesStyleReferent";
import type { HermesVersionStyleReferent } from "@/lib/hermes/agent/hermesVersionReferent";
import { getScriptBeatIdFromParams } from "@/lib/incomingScriptBinding";
import { orderedIncomingScriptNodeIds } from "@/lib/incomingScriptBinding";
import { useProjectStore } from "@/store/projectStore";
import {
  appendCanvasEvents,
  formatCanvasEventsForPrompt,
} from "@/lib/hermes/agent/hermesCanvasEvents";
import {
  loadHermesWorkstate,
  patchCachedHermesWorkstate,
  saveHermesWorkstate,
  type HermesCanvasReferent,
} from "@/lib/hermes/agent/hermesWorkstate";

let cachedEvents: HermesCanvasEvent[] = [];

export function getCachedCanvasEvents(): HermesCanvasEvent[] {
  return cachedEvents;
}

export function setCachedCanvasEventsForTest(events: HermesCanvasEvent[]): void {
  cachedEvents = events;
}

export function formatCachedCanvasEventsForPrompt(): string {
  return formatCanvasEventsForPrompt(cachedEvents);
}

export async function persistCanvasReferent(
  projectPath: string,
  referent: HermesCanvasReferent,
): Promise<void> {
  const ws = await loadHermesWorkstate(projectPath);
  const next = mergeCanvasReferent(ws.lastCanvasReferent, referent);
  if (!next) return;
  await saveHermesWorkstate(projectPath, { ...ws, lastCanvasReferent: next });
  patchCachedHermesWorkstate({ lastCanvasReferent: next });
}

export async function persistStyleAnchor(
  projectPath: string,
  anchor: HermesStyleAnchor,
): Promise<void> {
  const ws = await loadHermesWorkstate(projectPath);
  const next = mergeStyleAnchor(ws.lastStyleAnchor, anchor);
  if (!next) return;
  await saveHermesWorkstate(projectPath, { ...ws, lastStyleAnchor: next });
  patchCachedHermesWorkstate({ lastStyleAnchor: next });
}

export async function recordStyleAnchorFromScriptBeat(
  projectPath: string,
  scriptNodeId: string,
  beatId: string,
): Promise<void> {
  const scriptNode = useProjectStore
    .getState()
    .nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) return;
  const anchor = buildStyleAnchorFromScriptBeat(scriptNode, beatId);
  if (!anchor) return;
  await persistStyleAnchor(projectPath, anchor);
}

/** 图片 Agent 出图成功 commit 后调用（fire-and-forget） */
export function recordStyleAnchorFromImageNode(imageNodeId: string): void {
  const projectPath = useProjectStore.getState().projectPath?.trim();
  if (!projectPath) return;
  const state = useProjectStore.getState();
  const imageNode = state.nodes.find((n) => n.id === imageNodeId);
  if (!imageNode) return;
  const beatId = getScriptBeatIdFromParams(imageNode.data)?.trim();
  if (!beatId) return;
  const scriptIds = orderedIncomingScriptNodeIds(
    state.nodes,
    state.edges,
    imageNodeId,
  );
  const scriptNodeId = scriptIds[0];
  if (!scriptNodeId) return;
  void recordStyleAnchorFromScriptBeat(projectPath, scriptNodeId, beatId);
}

export async function persistVersionStyleReferent(
  projectPath: string,
  referent: HermesVersionStyleReferent,
): Promise<void> {
  const ws = await loadHermesWorkstate(projectPath);
  await saveHermesWorkstate(projectPath, {
    ...ws,
    lastVersionStyleReferent: referent,
  });
  patchCachedHermesWorkstate({ lastVersionStyleReferent: referent });
}

/** 视频 Agent 提交成功后记录运镜锚点（fire-and-forget） */
export function recordStyleAnchorFromVideoNode(videoNodeId: string): void {
  const projectPath = useProjectStore.getState().projectPath?.trim();
  if (!projectPath) return;
  const state = useProjectStore.getState();
  const videoNode = state.nodes.find((n) => n.id === videoNodeId);
  if (!videoNode) return;
  const beatId = getScriptBeatIdFromParams(videoNode.data)?.trim();
  if (!beatId) return;
  const scriptIds = orderedIncomingScriptNodeIds(
    state.nodes,
    state.edges,
    videoNodeId,
  );
  const scriptNodeId = scriptIds[0];
  if (!scriptNodeId) return;
  const scriptNode = state.nodes.find(
    (n) => n.id === scriptNodeId && n.type === "scriptNode",
  );
  if (!scriptNode) return;
  const draftPrompt = videoNode.data.video?.draft?.prompt?.trim();
  const anchor = buildStyleAnchorFromVideoBeat(scriptNode, beatId, draftPrompt);
  if (!anchor) return;
  void persistStyleAnchor(projectPath, anchor);
}

export async function ingestCanvasEvents(
  projectPath: string,
  incoming: HermesCanvasEvent[],
): Promise<HermesCanvasEvent[]> {
  if (incoming.length === 0) return cachedEvents;
  const ws = await loadHermesWorkstate(projectPath);
  const merged = appendCanvasEvents(ws.recentCanvasEvents ?? [], incoming);
  cachedEvents = merged;
  const referent = mergeCanvasReferent(
    ws.lastCanvasReferent,
    pickLatestReferentFromEvents(incoming),
  );
  const styleAnchor = mergeStyleAnchor(
    ws.lastStyleAnchor,
    pickLatestStyleAnchorFromEvents(incoming),
  );
  await saveHermesWorkstate(projectPath, {
    ...ws,
    recentCanvasEvents: merged,
    lastCanvasReferent: referent,
    lastStyleAnchor: styleAnchor,
  });
  patchCachedHermesWorkstate({
    lastCanvasReferent: referent,
    lastStyleAnchor: styleAnchor,
    recentCanvasEvents: merged,
  });
  return merged;
}

export async function refreshCanvasEventsCache(
  projectPath: string | null,
): Promise<void> {
  if (!projectPath?.trim()) {
    cachedEvents = [];
    return;
  }
  const ws = await loadHermesWorkstate(projectPath);
  cachedEvents = ws.recentCanvasEvents ?? [];
}

export function resetCanvasEventsCache(): void {
  cachedEvents = [];
}
