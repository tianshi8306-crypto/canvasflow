import type { FlowNodeData } from "@/lib/types";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";

type DispatchFn = (fromNodeId: string, force?: boolean) => Promise<void>;

type ScriptNodeDispatchInput = {
  prompt: string;
  dispatch: DispatchFn;
};

type ScriptNodeDispatchSensed = {
  prompt: string;
  dispatch: DispatchFn;
};

type TextNodeDispatchInput = {
  prompt: string;
  modelInput: string;
  dispatch: DispatchFn;
};

type TextNodeDispatchSensed = {
  normalizedPrompt: string;
  dispatch: DispatchFn;
};

/**
 * 脚本节点：从节点触发 DAG 子图执行（单任务确定性 Agent）。
 */
export const scriptNodeDispatchAgentRuntime: NodeTaskAgentRuntime<
  ScriptNodeDispatchInput,
  ScriptNodeDispatchSensed,
  ScriptNodeDispatchSensed,
  ScriptNodeDispatchSensed
> = {
  agentName: "脚本调度 Agent",
  sense: ({ prompt, dispatch }) => {
    const text = prompt.trim();
    if (!text) {
      throw new Error("请先输入剧情主题或脚本约束，再触发执行");
    }
    return { prompt: text, dispatch };
  },
  execute: async (sensed, ctx) => {
    ctx.setStatusText("正在 AI 解析镜头（DAG 调度）…");
    await sensed.dispatch(ctx.nodeId, false);
    return sensed;
  },
  validate: (executed) => executed,
  commit: () => {
    // 执行结果由 DAG 引擎统一回写节点记忆体，这里不做额外持久化。
  },
};

/**
 * 文本节点：执行前归一化输入（textModelInput 优先）并触发 DAG 子图执行。
 */
export const textNodeDispatchAgentRuntime: NodeTaskAgentRuntime<
  TextNodeDispatchInput,
  TextNodeDispatchSensed,
  TextNodeDispatchSensed,
  TextNodeDispatchSensed
> = {
  agentName: "文本调度 Agent",
  sense: ({ prompt, modelInput, dispatch }) => {
    const normalizedPrompt = (modelInput.trim() || prompt.trim()).trim();
    if (!normalizedPrompt) {
      throw new Error("请先输入正文或模型输入，再触发执行");
    }
    return { normalizedPrompt, dispatch };
  },
  execute: async (sensed, ctx) => {
    const patch: Partial<FlowNodeData> = { prompt: sensed.normalizedPrompt };
    // 执行前将归一化后的输入写回节点记忆体，确保 DAG 读取到确定性输入。
    ctx.updateNodeData(ctx.nodeId, patch);
    ctx.setStatusText("文本 Agent 已完成输入归一化，正在请求 DAG 调度…");
    await sensed.dispatch(ctx.nodeId, false);
    return sensed;
  },
  validate: (executed) => executed,
  commit: () => {
    // 最终结果由 DAG 执行器统一回写节点记忆体。
  },
};

