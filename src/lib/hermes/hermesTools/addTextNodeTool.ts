import type { Node } from "@xyflow/react";
import type { HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import type { FlowNodeData } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";

function defaultTextNodePosition(nodes: Node<FlowNodeData>[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 120, y: 120 };
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  return { x: maxX + 420, y: 120 };
}

export function runAddTextNodeTool(args?: {
  initialPrompt?: string;
}): HermesToolRunResult {
  const projectPath = useProjectStore.getState().projectPath?.trim();
  if (!projectPath) {
    return { ok: false, message: "请先打开或新建工程" };
  }

  const state = useProjectStore.getState();
  const id = crypto.randomUUID();
  const initial = args?.initialPrompt?.trim();
  const node: Node<FlowNodeData> = {
    id,
    type: "textNode",
    position: defaultTextNodePosition(state.nodes),
    data: {
      ...newNodeDataByType.textNode(),
      ...(initial ? { prompt: initial } : {}),
    },
  };
  state.addNode(node);
  state.setSelectedNodeIds([id]);
  state.setStatusText("Hermes：已创建文本节点");
  return {
    ok: true,
    message: initial
      ? "已在画布创建文本节点并写入初始文案"
      : "已在画布创建文本节点，可双击编辑内容",
  };
}
