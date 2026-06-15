import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";
import {
  buildTextNodeUpstreamTextRefs,
  expandPromptTextAtReferences,
  resolveMentionNodeTokens,
} from "@/lib/promptUpstreamTextRefs";
import { useProjectStore } from "@/store/projectStore";

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
  sense: ({ prompt, modelInput, dispatch }, ctx) => {
    const nodes = useProjectStore.getState().nodes;
    const edges = useProjectStore.getState().edges;
    // 多轮对话：如果既有正文又有新指令，将正文作为上下文包含进来
    const raw = modelInput.trim() && prompt.trim()
      ? `${prompt.trim()}\n\n${modelInput.trim()}`
      : (modelInput.trim() || prompt.trim()).trim();
    const withNodeMentions = resolveMentionNodeTokens(raw, nodes);
    const textRefs = buildTextNodeUpstreamTextRefs(nodes, edges, ctx.nodeId);
    const normalizedPrompt = expandPromptTextAtReferences(withNodeMentions, textRefs);
    if (!normalizedPrompt) {
      throw new Error("请先输入正文或模型输入，再触发执行");
    }
    return { normalizedPrompt, dispatch };
  },
  execute: async (sensed, ctx) => {
    const nodes = useProjectStore.getState().nodes;
    const edges = useProjectStore.getState().edges;
    const hasUpstreamText = buildTextNodeUpstreamTextRefs(nodes, edges, ctx.nodeId).length > 0;
    if (!hasUpstreamText) {
      // 无上游：将归一化输入写入 prompt，供 DAG 直接作为 LLM 输入
      ctx.updateNodeData(ctx.nodeId, { prompt: sensed.normalizedPrompt });
    }
  // 有上游：保留 prompt 供预览展示 LLM 结果；指令在 params.textModelInput，后端单独读取
    ctx.setStatusText(
      hasUpstreamText
        ? "正在根据上游文本处理…"
        : "文本 Agent 已完成输入归一化，正在请求 DAG 调度…",
    );
    await sensed.dispatch(ctx.nodeId, false);
    return sensed;
  },
  validate: (executed) => executed,
  commit: () => {
    // 最终结果由 DAG 执行器统一回写节点记忆体。
  },
};

