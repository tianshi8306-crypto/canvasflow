import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";
import { deriveRunFailureMessage } from "@/lib/runNodeState";
import {
  buildTextNodeUpstreamTextRefs,
  expandPromptTextAtReferences,
  resolveMentionNodeTokens,
} from "@/lib/promptUpstreamTextRefs";
import { fetchRunEvents } from "@/shared/api/runs";
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
    ctx.setStatusText("正在 AI 解析镜头（逐镜生成，长剧本可能需要数分钟）…");
    // 用户主动解析须 force，避免上次 succeeded 被增量跳过导致无新分镜
    await sensed.dispatch(ctx.nodeId, true);
    const { nodeRunStateById, lastRunId, projectPath } = useProjectStore.getState();
    if (nodeRunStateById[ctx.nodeId] === "failed") {
      let msg = "脚本解析失败，请打开侧栏「运行」面板查看详情";
      if (projectPath && lastRunId) {
        try {
          const events = await fetchRunEvents(projectPath, lastRunId);
          msg = deriveRunFailureMessage(events) ?? msg;
        } catch {
          /* 使用默认文案 */
        }
      }
      ctx.updateNodeData(ctx.nodeId, {
        status: {
          status: "failed",
          error: msg,
          updatedAt: Date.now(),
          agentName: "脚本",
        },
      });
      throw new Error(msg);
    }
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
      const node = nodes.find((n) => n.id === ctx.nodeId);
      const params =
        node?.data.params && typeof node.data.params === "object"
          ? { ...(node.data.params as Record<string, unknown>) }
          : {};
      // 预览区 data.prompt 仅展示模型输出；输入暂存 textModelInput 供后端读取
      ctx.updateNodeData(ctx.nodeId, {
        params: { ...params, textModelInput: sensed.normalizedPrompt },
      });
    }
    ctx.setStatusText(
      hasUpstreamText ? "正在根据上游文本处理…" : "正在请求模型生成…",
    );
    await sensed.dispatch(ctx.nodeId, true);
    return sensed;
  },
  validate: (executed) => executed,
  commit: (_executed, ctx) => {
    const node = useProjectStore.getState().nodes.find((n) => n.id === ctx.nodeId);
    if (!node) return;
    const params =
      node.data.params && typeof node.data.params === "object"
        ? { ...(node.data.params as Record<string, unknown>) }
        : {};
    const modelInput = (params.textModelInput as string | undefined)?.trim() ?? "";
    if (modelInput) {
      ctx.updateNodeData(ctx.nodeId, { params: { ...params, textModelInput: "" } });
    }
  },
};

