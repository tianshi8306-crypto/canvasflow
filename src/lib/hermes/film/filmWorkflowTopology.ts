import type { Edge, Node } from "@xyflow/react";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { makeFlowEdge } from "@/lib/flowEdge";
import { isConnectionAllowed } from "@/lib/flowConnectionPolicy";
import { CANVAS_NODE_LAYOUT_GAP } from "@/lib/nodeLayout";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";

const TEXT_ESTIMATE_W = 320;
const SCRIPT_ESTIMATE_W = 480;
const H_STEP = TEXT_ESTIMATE_W + CANVAS_NODE_LAYOUT_GAP + 80;

export type FilmWorkflowTemplateId = "short_drama_v1";

export type CreateStandardWorkflowInput = {
  brief: string;
  style?: string;
  shotCount?: number;
  totalDurationSec?: number;
  templateId?: FilmWorkflowTemplateId;
  /** 视口中心（flow 坐标）；缺省取当前 viewport 中心 */
  anchor?: { x: number; y: number };
};

export type CreateStandardWorkflowResult = {
  textNodeId: string;
  scriptNodeId: string;
  createdText: boolean;
  createdScript: boolean;
  linkedTextToScript: boolean;
};

function viewportCenterFlow(): { x: number; y: number } {
  const vp = useProjectStore.getState().viewport;
  const w = typeof window !== "undefined" ? window.innerWidth : 1400;
  const h = typeof window !== "undefined" ? window.innerHeight : 900;
  return {
    x: (w / 2 - vp.x) / vp.zoom,
    y: (h / 2 - vp.y) / vp.zoom,
  };
}

function placeholderBeats(count: number): ScriptBeat[] {
  const n = Math.min(Math.max(count, 0), 12);
  if (n === 0) return [];
  return Array.from({ length: n }, (_, i) =>
    normalizeScriptBeat({
      id: crypto.randomUUID(),
      shotNumber: String(i + 1),
      scene: "",
      durationHint: "",
      description: `镜头 ${i + 1}（待填写）`,
    }),
  );
}

/**
 * short_drama_v1：textNode → scriptNode；若已有 scriptNode 则只补 text 连线，不重复创建脚本。
 */
export function applyShortDramaWorkflow(
  input: CreateStandardWorkflowInput,
): CreateStandardWorkflowResult {
  const state = useProjectStore.getState();
  const anchor = input.anchor ?? viewportCenterFlow();
  const brief = input.brief.trim();
  const shotCount = input.shotCount ?? 0;

  const existingScript = findPrimaryScriptNode(state.nodes);
  let scriptNodeId = existingScript?.id ?? "";
  let createdScript = false;
  let textNodeId = "";
  let createdText = false;
  let linkedTextToScript = false;

  const newNodes: Node<FlowNodeData>[] = [];
  const newEdges: Edge[] = [];

  const textX = anchor.x - H_STEP - SCRIPT_ESTIMATE_W / 2;
  const textY = anchor.y - 60;
  const scriptX = anchor.x - SCRIPT_ESTIMATE_W / 2;
  const scriptY = anchor.y - 60;

  if (!existingScript) {
    scriptNodeId = crypto.randomUUID();
    const scriptData = newNodeDataByType.scriptNode();
    if (brief) scriptData.prompt = brief;
    if (shotCount > 0) {
      scriptData.scriptBeats = placeholderBeats(shotCount);
    }
    newNodes.push({
      id: scriptNodeId,
      type: "scriptNode",
      position: { x: scriptX, y: scriptY },
      data: scriptData,
    });
    createdScript = true;
  } else if (brief) {
    state.updateNodeData(
      scriptNodeId,
      {
        prompt: existingScript.data.prompt?.trim()
          ? existingScript.data.prompt
          : brief,
      },
      { silent: true },
    );
  }

  textNodeId = crypto.randomUUID();
  const textData = newNodeDataByType.textNode();
  textData.prompt = brief || "短剧创意大纲（待填写）";
  textData.label = "大纲";
  newNodes.push({
    id: textNodeId,
    type: "textNode",
    position: { x: textX, y: textY },
    data: textData,
  });
  createdText = true;

  if (
    isConnectionAllowed("textNode", "scriptNode") &&
    scriptNodeId
  ) {
    newEdges.push(makeFlowEdge(textNodeId, scriptNodeId, "textNode"));
    linkedTextToScript = true;
  }

  if (newNodes.length > 0) {
    state.addNodesWithEdges(newNodes, newEdges);
    state.setSelectedNodeIds([scriptNodeId || textNodeId]);
  }

  const styleNote = input.style?.trim();
  if (styleNote) {
    state.setStatusText(`Hermes：已搭建短剧流程（风格：${styleNote}）`);
  } else {
    state.setStatusText("Hermes：已搭建短剧标准流程（大纲 → 脚本）");
  }

  return {
    textNodeId,
    scriptNodeId,
    createdText,
    createdScript,
    linkedTextToScript,
  };
}
