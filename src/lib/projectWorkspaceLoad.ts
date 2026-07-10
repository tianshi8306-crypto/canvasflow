import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Edge, Node, Viewport } from "@xyflow/react";
import { rebuildShotNodeRegistry } from "@/lib/hermes";
import { migrateScriptNodesOnLoad } from "@/lib/scriptBeatsMigration";
import { reconcileBeatsPromptFields } from "@/lib/scriptPromptSynthesis";
import { isCanvasMediaNodeType } from "@/lib/nodeMediaRef";
import { rememberProjectOpened } from "@/lib/recentProjects";
import { defaultViewport, parseCanvas, serializeCanvas } from "@/lib/serialization";
import type { FlowNodeData } from "@/lib/types";
import { backfillCanvasAssetIds, type ScriptNodeAssetPatch } from "@/shared/api/assets";
import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import { getFlowClipboardCount } from "@/store/projectClipboard";
import { clearHistoryStacks } from "@/store/projectHistory";
import { normalizeGroupNodesForCanvas } from "@/lib/canvasGroup";
import { sanitizeCanvasEdges } from "@/lib/flowConnectionPolicy";
import { applyTextWorkflowSyncToNodes } from "@/lib/textNodeWorkflowSync";
import { stripEphemeralNodeFields } from "@/lib/reactFlowControlled";

export type ProjectGraphSnapshot = {
  projectPath: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  viewport: Viewport;
  statusText: string;
  /** 打开时自动补全 assetId 后应为 true，提示用户保存工程 */
  projectDirtyFromBackfill?: boolean;
  imageNodeCounter: number;
  videoNodeCounter: number;
  textNodeCounter: number;
  audioNodeCounter: number;
  scriptNodeCounter: number;
};

function maxNumberedLabelIndex(
  nodes: Node<FlowNodeData>[],
  nodeType: string,
  prefix: string,
): number {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(\\d+)$`);
  return nodes
    .filter((n) => n.type === nodeType)
    .reduce((acc, n) => {
      const m = String(n.data.label ?? "").match(re);
      return Math.max(acc, m ? parseInt(m[1], 10) : 0);
    }, 0);
}

function applyScriptAssetPatches(
  nodes: Node<FlowNodeData>[],
  scriptPatches: ScriptNodeAssetPatch[],
): Node<FlowNodeData>[] {
  if (scriptPatches.length === 0) return nodes;
  const byId = new Map(scriptPatches.map((p) => [p.scriptNodeId, p]));
  return nodes.map((n) => {
    const patch = byId.get(n.id);
    if (!patch || n.type !== "scriptNode") return n;
    const data: FlowNodeData = { ...n.data };
    if (patch.storyboardShots) {
      data.storyboardShots = patch.storyboardShots as StoryboardShot[];
    }
    if (patch.scriptBeats) {
      data.scriptBeats = reconcileBeatsPromptFields(patch.scriptBeats as ScriptBeat[]);
    }
    return { ...n, data };
  });
}

async function applyAssetIdBackfill(
  folder: string,
  nodes: Node<FlowNodeData>[],
): Promise<{ nodes: Node<FlowNodeData>[]; patched: number }> {
  if (!isTauri()) return { nodes, patched: 0 };
  const payloadNodes = nodes.filter(
    (n) => isCanvasMediaNodeType(n.type) || n.type === "scriptNode",
  );
  if (payloadNodes.length === 0) return { nodes, patched: 0 };
  try {
    const result = await backfillCanvasAssetIds(
      folder,
      payloadNodes.map((n) => ({
        id: n.id,
        type: n.type ?? "",
        data: n.data as Record<string, unknown>,
      })),
    );
    const nodePatchCount = result.nodePatches.length;
    const scriptPatchCount = result.scriptPatches.length;
    if (nodePatchCount === 0 && scriptPatchCount === 0) return { nodes, patched: 0 };

    const nodePatchById = new Map(result.nodePatches.map((p) => [p.nodeId, p]));
    let next = nodes.map((n) => {
      const patch = nodePatchById.get(n.id);
      if (!patch) return n;
      return {
        ...n,
        data: { ...n.data, assetId: patch.assetId, path: patch.relPath },
      };
    });
    next = applyScriptAssetPatches(next, result.scriptPatches);
    return { nodes: next, patched: nodePatchCount + scriptPatchCount };
  } catch {
    return { nodes, patched: 0 };
  }
}

/** 从节点标签推导计数器下限（保存 Tab 快照等与 store 计数器未同步的场景） */
export function deriveNodeCountersFromCanvas(nodes: Node<FlowNodeData>[]) {
  return {
    imageNodeCounter: maxNumberedLabelIndex(nodes, "imageNode", "图片"),
    videoNodeCounter: maxNumberedLabelIndex(nodes, "videoNode", "视频"),
    textNodeCounter: maxNumberedLabelIndex(nodes, "textNode", "文本"),
    audioNodeCounter: maxNumberedLabelIndex(nodes, "audioNode", "音频"),
    scriptNodeCounter: maxNumberedLabelIndex(nodes, "scriptNode", "分镜脚本"),
  };
}

function countersFromNodes(nodes: Node<FlowNodeData>[]) {
  const c = deriveNodeCountersFromCanvas(nodes);
  return {
    maxImgIdx: c.imageNodeCounter,
    maxVidIdx: c.videoNodeCounter,
    maxTextIdx: c.textNodeCounter,
    maxAudioIdx: c.audioNodeCounter,
    maxScriptIdx: c.scriptNodeCounter,
  };
}

/** 将本地工程目录载入 store（新建空白或读取 canvasflow.json） */
export async function loadProjectFolder(
  folder: string,
  mode: "open" | "new",
): Promise<ProjectGraphSnapshot> {
  await invoke("ensure_project_structure", { projectPath: folder });
  rememberProjectOpened(folder);
  clearHistoryStacks();

  if (mode === "new") {
    rebuildShotNodeRegistry([]);
    return {
      projectPath: folder,
      nodes: [],
      edges: [],
      viewport: defaultViewport,
      statusText: `工程：${folder}`,
      imageNodeCounter: 0,
      videoNodeCounter: 0,
      textNodeCounter: 0,
      audioNodeCounter: 0,
      scriptNodeCounter: 0,
    };
  }

  try {
    const raw = await invoke<string>("read_canvasflow_json", { projectPath: folder });
    const parsed = parseCanvas(raw);
    let { nodes } = parsed;
    const migration = migrateScriptNodesOnLoad(nodes);
    nodes = migration.nodes;
    const { edges, viewport, invalidEdgesDropped, meta } = parsed;
    const backfill = await applyAssetIdBackfill(folder, nodes);
    nodes = backfill.nodes;
    const { maxImgIdx, maxVidIdx, maxTextIdx, maxAudioIdx, maxScriptIdx } = countersFromNodes(nodes);
    rebuildShotNodeRegistry(nodes);
    const statusBase = `工程：${folder}`;
    const suffixParts: string[] = [];
    if (invalidEdgesDropped > 0) {
      suffixParts.push(`已移除 ${invalidEdgesDropped} 条不兼容连线`);
    }
    if (backfill.patched > 0) {
      suffixParts.push(`已补全 ${backfill.patched} 个素材 ID`);
    }
    if (migration.migratedCount > 0) {
      suffixParts.push(`已迁移 ${migration.migratedCount} 个脚本节点镜头表`);
    }
    const statusText =
      suffixParts.length > 0 ? `${statusBase}（${suffixParts.join("；")}）` : statusBase;
    return {
      projectPath: folder,
      nodes,
      edges,
      viewport,
      statusText,
      projectDirtyFromBackfill: backfill.patched > 0 || migration.migratedCount > 0,
      imageNodeCounter: meta?.imageNodeCounter != null ? meta.imageNodeCounter : maxImgIdx,
      videoNodeCounter: meta?.videoNodeCounter != null ? meta.videoNodeCounter : maxVidIdx,
      textNodeCounter: meta?.textNodeCounter != null ? meta.textNodeCounter : maxTextIdx,
      audioNodeCounter: meta?.audioNodeCounter != null ? meta.audioNodeCounter : maxAudioIdx,
      scriptNodeCounter: meta?.scriptNodeCounter != null ? meta.scriptNodeCounter : maxScriptIdx,
    };
  } catch {
    const empty = serializeCanvas([], [], defaultViewport);
    await invoke("write_canvasflow_json", { projectPath: folder, content: empty });
    rebuildShotNodeRegistry([]);
    return {
      projectPath: folder,
      nodes: [],
      edges: [],
      viewport: defaultViewport,
      statusText: `工程：${folder}（已创建空白 canvasflow.json）`,
      imageNodeCounter: 0,
      videoNodeCounter: 0,
      textNodeCounter: 0,
      audioNodeCounter: 0,
      scriptNodeCounter: 0,
    };
  }
}

function prepareCanvasGraph(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  const { edges: cleanedEdges } = sanitizeCanvasEdges(nodes, edges);
  const syncedNodes = stripEphemeralNodeFields(
    normalizeGroupNodesForCanvas(applyTextWorkflowSyncToNodes(nodes, cleanedEdges)),
  );
  return { nodes: syncedNodes, edges: cleanedEdges };
}

export function applyProjectSnapshot(
  snapshot: ProjectGraphSnapshot,
): Omit<ProjectGraphSnapshot, "statusText"> & {
  statusText: string;
  selectedNodeId: null;
  selectedNodeIds: [];
  selectedEdgeIds: [];
  lastRunId: null;
  nodeRunStateById: Record<string, never>;
  flowClipboardCount: number;
  lastSavedAt: number | null;
  projectDirty: boolean;
  graphRevision: number;
} {
  const graph = prepareCanvasGraph(snapshot.nodes, snapshot.edges);
  return {
    projectPath: snapshot.projectPath,
    nodes: graph.nodes,
    edges: graph.edges,
    viewport: snapshot.viewport,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    lastRunId: null,
    nodeRunStateById: {},
    statusText: snapshot.statusText,
    flowClipboardCount: getFlowClipboardCount(),
    imageNodeCounter: snapshot.imageNodeCounter,
    videoNodeCounter: snapshot.videoNodeCounter,
    textNodeCounter: snapshot.textNodeCounter,
    audioNodeCounter: snapshot.audioNodeCounter,
    scriptNodeCounter: snapshot.scriptNodeCounter,
    lastSavedAt: Date.now(),
    projectDirty: snapshot.projectDirtyFromBackfill === true,
    graphRevision: 0,
  };
}
