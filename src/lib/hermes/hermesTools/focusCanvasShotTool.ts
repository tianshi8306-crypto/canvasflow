import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { pulseHermesAgentHighlight } from "@/store/hermesCanvasHighlightStore";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { openInspectorStoryboardBeat } from "@/lib/scriptNodeCanvasEntries";
import {
  findImageNodesForScript,
  findVideoNodesForScript,
} from "@/lib/storyboard/storyboardMediaNodes";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

export type CanvasFocusTarget = "auto" | "script" | "image" | "video";

function resolveFocusTarget(args: Record<string, unknown> | undefined): CanvasFocusTarget {
  const raw = String(args?.target ?? "auto").trim().toLowerCase();
  if (raw === "script" || raw === "storyboard" || raw === "table") return "script";
  if (raw === "image" || raw === "video") return raw;
  return "auto";
}

function beatLabel(scriptNodeId: string, beatId: string): string {
  const beats = normalizeScriptBeats(
    useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId)?.data.scriptBeats,
  );
  const beat = beats.find((b) => b.id === beatId);
  return beat?.shotNumber?.trim() || beatId.slice(0, 8);
}

export function runCanvasFocusTool(
  step: HermesPlanStep,
  opts: { sourceMessage: string; scriptNodeId?: string | null },
): HermesToolRunResult {
  const state = useProjectStore.getState();
  const scriptNodeId =
    opts.scriptNodeId?.trim() || findPrimaryScriptNode(state.nodes)?.id || null;
  if (!scriptNodeId) {
    return { ok: false, message: "请先在画布上创建脚本节点" };
  }

  const beatIds = resolveToolBeatIds(scriptNodeId, step.args, opts.sourceMessage);
  if (!beatIds?.length) {
    return { ok: false, message: "请指定镜号（如「定位第 2 镜」）", scriptNodeId };
  }

  const target = resolveFocusTarget(step.args);
  const ui = useCanvasUiStore.getState();

  if (target === "script") {
    const beatId = beatIds[0]!;
    openInspectorStoryboardBeat(scriptNodeId, beatId);
    pulseHermesAgentHighlight([scriptNodeId], step.label);
    state.setStatusText(`Hermes：已在脚本表聚焦第 ${beatLabel(scriptNodeId, beatId)} 镜`);
    return {
      ok: true,
      message: `已打开脚本全屏并聚焦第 ${beatLabel(scriptNodeId, beatId)} 镜`,
      scriptNodeId,
    };
  }

  const imageByBeat = findImageNodesForScript(scriptNodeId, state.nodes, state.edges);
  const videoByBeat = findVideoNodesForScript(scriptNodeId, state.nodes, state.edges);
  const mediaNodeIds: string[] = [];

  for (const beatId of beatIds) {
    let nodeId: string | undefined;
    if (target === "video") {
      nodeId = videoByBeat.get(beatId);
    } else if (target === "image") {
      nodeId = imageByBeat.get(beatId);
    } else {
      nodeId = videoByBeat.get(beatId) ?? imageByBeat.get(beatId);
    }
    if (nodeId) mediaNodeIds.push(nodeId);
  }

  if (mediaNodeIds.length === 0) {
    const beatId = beatIds[0]!;
    openInspectorStoryboardBeat(scriptNodeId, beatId);
    pulseHermesAgentHighlight([scriptNodeId], step.label);
    state.setStatusText(`Hermes：该镜尚未建链，已在脚本表聚焦`);
    return {
      ok: true,
      message: `第 ${beatLabel(scriptNodeId, beatId)} 镜尚无图片/视频节点，已在脚本表聚焦`,
      scriptNodeId,
    };
  }

  const uniqueIds = [...new Set(mediaNodeIds)];
  state.setSelectedNodeIds(uniqueIds);
  ui.requestCanvasFitToNode(uniqueIds[0]!);
  pulseHermesAgentHighlight(uniqueIds, step.label);

  const labels = beatIds.map((id) => beatLabel(scriptNodeId, id)).join("、");
  const kind =
    target === "video" ? "视频" : target === "image" ? "图片" : "媒体";
  state.setStatusText(`Hermes：已定位到第 ${labels} 镜${kind}节点`);
  return {
    ok: true,
    message: `已选中并缩放至第 ${labels} 镜的${kind}节点`,
    scriptNodeId,
  };
}
