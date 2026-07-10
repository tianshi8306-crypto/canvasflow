import { normalizeTextPromptMarkdown } from "@/lib/textPromptMarkdown";
import { textNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import {
  gatherUpstreamContextForTextProcessing,
  hasUpstreamForTextProcessing,
  runTextNodeUpstreamLlmProcess,
} from "@/lib/textNodeUpstreamProcess";
import { useProjectStore } from "@/store/projectStore";
import type { FlowNodeData } from "@/lib/types";

type DispatchFn = (fromNodeId: string, force?: boolean) => Promise<void>;

type Params = {
  nodeId: string;
  projectPath: string | null;
  prompt: string;
  modelInput: string;
  runNodeSubgraph: DispatchFn;
  updateNodeData: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  setStatusText: (text: string) => void;
};

function paramsRecord(data: FlowNodeData | undefined): Record<string, unknown> {
  const p = data?.params;
  return p && typeof p === "object" && !Array.isArray(p) ? { ...p } : {};
}

export async function dispatchTextNodeComposerRun({
  nodeId,
  projectPath,
  prompt,
  modelInput,
  runNodeSubgraph,
  updateNodeData,
  setStatusText,
}: Params): Promise<void> {
  if (!projectPath) {
    setStatusText("请先打开工程目录");
    return;
  }

  const instruction = modelInput.trim();
  if (!instruction && !prompt.trim()) {
    setStatusText("请先输入处理指令或正文");
    return;
  }

  const nodes = useProjectStore.getState().nodes;
  const edges = useProjectStore.getState().edges;
  const node = nodes.find((n) => n.id === nodeId);
  const params = paramsRecord(node?.data);
  const providerId = (params.providerId as string | undefined)?.trim();
  const model = (params.model as string | undefined)?.trim();

  // 有上游：直接 LLM 处理，不跑子图（避免误跑脚本节点 / 下游节点）
  if (hasUpstreamForTextProcessing(nodes, edges, nodeId)) {
    const upstreamBlocks = gatherUpstreamContextForTextProcessing(nodes, edges, nodeId);
    try {
      const result = await runTextNodeUpstreamLlmProcess({
        nodeId,
        instruction,
        priorResult: prompt,
        upstreamBlocks,
        providerId,
        model,
      });
      updateNodeData(nodeId, {
        prompt: normalizeTextPromptMarkdown(result),
        params: { ...params, textModelInput: "" },
      });
      setStatusText("处理完成，结果已写入预览");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatusText(`文本处理失败：${msg}`);
      throw e;
    }
    return;
  }

  // 无上游：原有 DAG 子图流程（自由创作 / 生成正文）
  await runNodeTaskAgent(
    textNodeDispatchAgentRuntime,
    {
      prompt,
      modelInput,
      dispatch: runNodeSubgraph,
    },
    {
      nodeId,
      projectPath,
      updateNodeData,
      setStatusText,
    },
  );
}
