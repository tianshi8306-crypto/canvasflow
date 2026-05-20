/**
 * useNodeStatus - 节点状态管理 Hook
 *
 * 监听 node-agent-event 全局事件，维护节点运行状态
 * 用于在画布上显示节点状态角标（idle/running/succeeded/failed）
 */

import { useCallback, useEffect, useRef } from "react";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";
import type { NodeExecutionStatus } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";

/** 根据 Agent phase 映射到执行状态 */
function phaseToStatus(phase: string): NodeExecutionStatus {
  switch (phase) {
    case "start":
    case "sense":
    case "execute":
    case "validate":
    case "commit":
      return "running";
    case "end":
      return "succeeded";
    case "error":
      return "failed";
    default:
      return "pending";
  }
}

/** 根据 agentName 生成简短标签 */
function getAgentLabel(agentName: string): string {
  if (agentName.includes("脚本调度")) return "脚本";
  if (agentName.includes("分镜")) return "分镜";
  if (agentName.includes("视频")) return "视频";
  if (agentName.includes("图片")) return "图片";
  if (agentName.includes("音频")) return "音频";
  if (agentName.includes("TTS")) return "TTS";
  return agentName.slice(0, 4);
}

/** 计算进度（基于 phase） */
function getProgressFromPhase(phase: string): number {
  switch (phase) {
    case "start": return 10;
    case "sense": return 30;
    case "execute": return 50;
    case "validate": return 70;
    case "commit": return 90;
    case "end": return 100;
    default: return 0;
  }
}

/**
 * 为指定节点更新状态
 */
export function useNodeStatus(nodeId?: string) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const nodes = useProjectStore((s) => s.nodes);

  /** 更新节点状态 */
  const setNodeStatus = useCallback(
    (status: NodeExecutionStatus, detail?: { agentName?: string; phase?: string; error?: string; progress?: number }) => {
      if (!nodeId) return;
      updateNodeData(nodeId, {
        status: {
          status,
          updatedAt: Date.now(),
          agentName: detail?.agentName,
          phase: detail?.phase,
          error: detail?.error,
          progress: detail?.progress,
        },
      });
    },
    [nodeId, updateNodeData],
  );

  /** 获取当前节点状态 */
  const currentStatus = nodes.find((n) => n.id === nodeId)?.data.status;

  /** 清除节点状态 */
  const clearStatus = useCallback(() => {
    if (!nodeId) return;
    updateNodeData(nodeId, { status: undefined });
  }, [nodeId, updateNodeData]);

  return {
    status: currentStatus,
    setNodeStatus,
    clearStatus,
  };
}

/**
 * 全局节点状态监听器
 * 在 App 或画布层级调用一次即可
 */
export function useNodeStatusListener() {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const handlerRef = useRef<((evt: CustomEvent<NodeAgentRuntimeEvent>) => void) | null>(null);

  useEffect(() => {
    const handler = (evt: CustomEvent<NodeAgentRuntimeEvent>) => {
      const { nodeId, agentName, phase, error } = evt.detail;

      const status: NodeExecutionStatus = phaseToStatus(phase);
      const progress = getProgressFromPhase(phase);

      updateNodeData(nodeId, {
        status: {
          status,
          updatedAt: Date.now(),
          agentName: getAgentLabel(agentName),
          phase,
          error,
          progress: phase === "error" ? undefined : progress,
        },
      });
    };

    handlerRef.current = handler;
    window.addEventListener("node-agent-event", handler as EventListener);

    return () => {
      if (handlerRef.current) {
        window.removeEventListener("node-agent-event", handlerRef.current as EventListener);
      }
    };
  }, [updateNodeData]);
}
