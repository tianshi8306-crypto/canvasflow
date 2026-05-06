import { textNodeDispatchAgentRuntime } from "@/lib/nodeAgentRuntime/dagnodeDispatchAgents";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
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
