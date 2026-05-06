import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";

/**
 * 为粘贴的脚本节点生成「旧 beat id → 新 id」映射，使副本与原件在画布上互不冲突（R2 验收）。
 */
export function buildScriptBeatIdRemapForPaste(beats: ScriptBeat[] | undefined): Map<string, string> {
  const m = new Map<string, string>();
  if (!beats?.length) return m;
  for (const b of beats) {
    if (!m.has(b.id)) m.set(b.id, crypto.randomUUID());
  }
  return m;
}

function remapShotIdField(
  shotId: string | undefined,
  beatOldId: string,
  beatIdMap: Map<string, string>,
): string | undefined {
  if (shotId == null || shotId === "") return shotId;
  if (beatIdMap.has(shotId)) return beatIdMap.get(shotId);
  if (shotId === beatOldId) return beatIdMap.get(beatOldId) ?? shotId;
  return shotId;
}

/** 将映射应用到脚本节点 data（beats / 勾选 / 分镜 shot 引用）。 */
export function applyScriptBeatRemapToScriptNodeData(
  data: FlowNodeData,
  beatIdMap: Map<string, string>,
): FlowNodeData {
  if (beatIdMap.size === 0) return data;
  const beats = (data.scriptBeats ?? []).map((b) => {
    const newId = beatIdMap.get(b.id) ?? b.id;
    return {
      ...b,
      id: newId,
      shotId: remapShotIdField(b.shotId, b.id, beatIdMap),
    };
  });
  const sel = (data.scriptBeatSelection ?? []).map((id) => beatIdMap.get(id) ?? id);
  const shots = (data.storyboardShots ?? []).map((s) => ({
    ...s,
    scriptBeatId: beatIdMap.get(s.scriptBeatId) ?? s.scriptBeatId,
  }));
  return { ...data, scriptBeats: beats, scriptBeatSelection: sel, storyboardShots: shots };
}

/**
 * 在剪贴板子图内从目标节点沿入边回溯，找到最近的脚本节点（与「从脚本同步」拓扑一致）。
 */
export function findUpstreamScriptNodeIdInSubgraph(
  targetOldId: string,
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
): string | null {
  const visited = new Set<string>();
  const queue: string[] = [targetOldId];
  visited.add(targetOldId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (isEdgeDisabled(e)) continue;
      if (e.target !== cur) continue;
      const sid = e.source;
      const n = nodes.find((x) => x.id === sid);
      if (n?.type === "scriptNode") return sid;
      if (!visited.has(sid)) {
        visited.add(sid);
        queue.push(sid);
      }
    }
  }
  return null;
}

/** 若下游节点通过边依赖某脚本副本，则同步重写 `params.scriptBeatId`。 */
export function remapParamsScriptBeatIdForPaste(
  data: FlowNodeData,
  beatIdMap: Map<string, string> | undefined,
): FlowNodeData {
  if (!beatIdMap?.size) return data;
  const p = data.params;
  if (!p || typeof p !== "object") return data;
  const raw = (p as Record<string, unknown>).scriptBeatId;
  if (typeof raw !== "string" || !raw.trim()) return data;
  const next = beatIdMap.get(raw);
  if (!next) return data;
  return { ...data, params: { ...p, scriptBeatId: next } };
}
