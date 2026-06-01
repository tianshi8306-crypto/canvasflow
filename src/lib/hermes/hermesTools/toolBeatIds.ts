import type { Node } from "@xyflow/react";
import { beatIdsForShotNumbers } from "@/lib/hermes/hermesCanvasContext";
import { resolveHermesShotNumbers } from "@/lib/hermes/hermesReferentResolution";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import type { FlowNodeData } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";

/** 从步骤 args（镜号数组）或用户原文解析 beatId 列表 */
export function resolveToolBeatIds(
  scriptNodeId: string,
  args: Record<string, unknown> | undefined,
  sourceMessage: string,
  nodesOverride?: Node<FlowNodeData>[],
): string[] | undefined {
  const nodeList = nodesOverride ?? useProjectStore.getState().nodes;
  const beats = normalizeScriptBeats(
    nodeList.find((n) => n.id === scriptNodeId)?.data.scriptBeats,
  );
  const fromArgs = args?.beatIds;
  if (Array.isArray(fromArgs) && fromArgs.every((x) => typeof x === "number")) {
    return beatIdsForShotNumbers(beats, fromArgs as number[]);
  }
  const nums = resolveHermesShotNumbers(sourceMessage);
  if (nums.length === 0) return undefined;
  const ids = beatIdsForShotNumbers(beats, nums);
  return ids.length > 0 ? ids : undefined;
}
