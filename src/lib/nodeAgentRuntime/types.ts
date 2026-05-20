import type { FlowNodeData } from "@/lib/types";

/**
 * 下方面板绑定的单任务垂直 Agent 运行时上下文。
 * 上方节点主体（node.data）是唯一持久化记忆体，本上下文只负责执行过程。
 */
export type NodeAgentContext = {
  nodeId: string;
  projectPath: string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  setStatusText: (text: string) => void;
  reportAgentEvent?: (event: NodeAgentRuntimeEvent) => void;
  /** 外部可通过此对象主动取消执行（Agent execute 应检查 cancelToken?.cancelled） */
  cancelToken?: { cancelled: boolean };
};

export type NodeAgentPhase =
  | "start"
  | "sense"
  | "execute"
  | "validate"
  | "commit"
  | "end"
  | "error";

export type NodeAgentRuntimeEvent = {
  agentName: string;
  nodeId: string;
  projectPath: string;
  phase: NodeAgentPhase;
  timestampMs: number;
  elapsedMs: number;
  error?: string;
};

/**
 * 单任务确定性 Agent：感知输入 -> 执行 -> 校验 -> 回写记忆体。
 */
export type NodeTaskAgentRuntime<TInput, TSensed, TExecuted, TCommitted> = {
  agentName: string;
  sense: (input: TInput, ctx: NodeAgentContext) => TSensed | Promise<TSensed>;
  execute: (sensed: TSensed, ctx: NodeAgentContext) => TExecuted | Promise<TExecuted>;
  validate: (executed: TExecuted, ctx: NodeAgentContext) => TCommitted | Promise<TCommitted>;
  commit: (committed: TCommitted, ctx: NodeAgentContext) => void | Promise<void>;
};

