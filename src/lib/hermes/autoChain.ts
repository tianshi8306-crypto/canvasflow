/**
 * Hermes 自动串联核心逻辑
 *
 * 监听 scriptNode 完成事件，自动为每个 storyboardShots 创建 imageNode + videoNode 配对
 * 监听 videoNode 完成事件，联动更新 storyboardShot 状态
 */

import type { Edge } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { makeFlowEdge } from "@/lib/flowEdge";
import { normalizeSourceHandle } from "@/lib/flowConnectionPolicy";
import { createShotNodePair } from "./shotNodeFactory";
import type { HermesAutoChainResult, HermesShotNodeGroup } from "./types";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

const SCRIPT_NODE_AGENT_NAME = "脚本调度 Agent";
const VIDEO_AGENT_NAME = "视频 Agent";
const VIDEO_ASYNC_AGENT_NAME = "视频异步任务 Agent";
const BASE_X_OFFSET = 500;

/**
 * videoNodeId -> { scriptNodeId, scriptBeatId }
 * 用于 videoNode 完成时联动更新 storyboardShot 状态
 */
const shotNodeRegistry = new Map<string, { scriptNodeId: string; scriptBeatId: string }>();

/**
 * 根据 nodes 数组重建 shotNodeRegistry
 * 当工程重新打开时，从已保存的节点数据中恢复映射关系
 */
export function rebuildShotNodeRegistry(nodes: Node<FlowNodeData>[]): void {
  shotNodeRegistry.clear();
  for (const node of nodes) {
    if (node.type === "videoNode" && node.data.params?.scriptBeatId) {
      // 尝试从相邻边找到关联的 scriptNode
      const state = useProjectStore.getState();
      const edges = state.edges;
      // 通过边的 targetHandle 或其他方式确定关联的 scriptNode
      // 这里假设 videoNode 通过 imageNode 连接到 scriptNode
      const incomingEdge = edges.find(
        (e) =>
          e.target === node.id &&
          (!e.sourceHandle || normalizeSourceHandle(e.sourceHandle) === "out"),
      );
      if (incomingEdge) {
        const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
        if (sourceNode?.type === "imageNode") {
          // 找到 imageNode，继续向上找 scriptNode
          const imageToScriptEdge = edges.find(
            (e) =>
              e.target === sourceNode.id &&
              (!e.sourceHandle || normalizeSourceHandle(e.sourceHandle) === "out"),
          );
          if (imageToScriptEdge) {
            shotNodeRegistry.set(node.id, {
              scriptNodeId: imageToScriptEdge.source,
              scriptBeatId: String(node.data.params.scriptBeatId),
            });
            continue;
          }
        }
      }
      // 如果找不到上游边但有 scriptBeatId，仍尝试通过 scriptBeatId 关联
      // 这对于已生成的节点是足够的信息
      shotNodeRegistry.set(node.id, {
        scriptNodeId: "", // 未知，但 scriptBeatId 足以定位
        scriptBeatId: String(node.data.params.scriptBeatId),
      });
    }
  }
}

/**
 * 处理 scriptNode 完成事件，创建下游节点
 */
export function handleScriptNodeCompleted(scriptNodeId: string): HermesAutoChainResult {
  const state = useProjectStore.getState();
  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");

  if (!scriptNode) {
    return { total: 0, succeeded: 0, failed: 0, groups: [] };
  }

  const shots = scriptNode.data.storyboardShots ?? [];
  const beats = scriptNode.data.scriptBeats ?? [];

  if (shots.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, groups: [] };
  }

  const results: HermesShotNodeGroup[] = [];
  let succeeded = 0;
  let failed = 0;

  const baseX = scriptNode.position.x + BASE_X_OFFSET;
  const baseY = scriptNode.position.y;

  const newNodes: ReturnType<typeof createShotNodePair>["nodes"][] = [];
  const newEdges: Edge[] = [];

  for (let idx = 0; idx < shots.length; idx++) {
    const shot = shots[idx];
    const beat = beats.find((b) => b.id === shot.scriptBeatId);

    try {
      const { nodes, group } = createShotNodePair(shot, beat, { x: baseX, y: baseY }, idx);
      const [imageNode, videoNode] = nodes;

      // 记录节点
      newNodes.push(nodes);

      // 注册 videoNode -> scriptNode/scriptBeatId 映射（用于后续联动）
      shotNodeRegistry.set(videoNode.id, { scriptNodeId, scriptBeatId: shot.scriptBeatId });

      // 创建边：scriptNode → imageNode → videoNode
      newEdges.push(makeFlowEdge(scriptNodeId, imageNode.id, "scriptNode"));
      newEdges.push(makeFlowEdge(imageNode.id, videoNode.id, "imageNode"));

      results.push(group);
      succeeded++;
    } catch (err) {
      console.error(`[Hermes] 创建 Shot 节点失败: ${shot.scriptBeatId}`, err);
      failed++;
    }
  }

  // 批量添加节点和边
  if (newNodes.length > 0) {
    const flatNodes = newNodes.flat();
    state.addNodesWithEdges(flatNodes, newEdges);
  }

  return { total: shots.length, succeeded, failed, groups: results };
}

/**
 * 联动更新 storyboardShot 状态
 * 当 videoNode 完成时，根据 scriptBeatId 更新对应 storyboardShot 的视频生成状态
 */
function syncVideoNodeStatusToStoryboard(
  videoNodeId: string,
  phase: "end" | "error",
  error?: string,
): void {
  const registryEntry = shotNodeRegistry.get(videoNodeId);
  if (!registryEntry) return;

  const { scriptNodeId, scriptBeatId } = registryEntry;
  const state = useProjectStore.getState();
  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) return;

  const shots = scriptNode.data.storyboardShots ?? [];
  const shotIndex = shots.findIndex((s) => s.scriptBeatId === scriptBeatId);
  if (shotIndex === -1) return;

  // 复制并更新 shots
  const updatedShots = [...shots];
  const currentShot = updatedShots[shotIndex];

  if (phase === "end") {
    updatedShots[shotIndex] = {
      ...currentShot,
      videoStatus: "generated",
      videoNodeId,
      videoError: undefined,
    };
  } else {
    updatedShots[shotIndex] = {
      ...currentShot,
      videoStatus: "failed",
      videoError: error ?? "视频生成失败",
    };
  }

  // 回写 storyboardShots
  state.updateNodeData(scriptNodeId, { storyboardShots: updatedShots });
}

/**
 * 监听 node-agent-event 事件，触发自动串联和状态联动
 */
export function setupNodeEventListener(): () => void {
  const handler = (evt: CustomEvent<NodeAgentRuntimeEvent>) => {
    const { nodeId, agentName, phase, error } = evt.detail;

    // scriptNode 完成 -> 触发自动串联
    if (phase === "end" && agentName === SCRIPT_NODE_AGENT_NAME) {
      setTimeout(() => {
        const result = handleScriptNodeCompleted(nodeId);

        if (result.total > 0) {
          const { succeeded, failed } = result;
          let statusMsg = `Shot 节点创建完成：${succeeded} 个成功`;
          if (failed > 0) {
            statusMsg += `，${failed} 个失败`;
          }
          useProjectStore.getState().setStatusText(statusMsg);
        }
      }, 0);
      return;
    }

    // videoNode 完成 -> 联动更新 storyboardShot 状态
    if ((phase === "end" || phase === "error") &&
        (agentName === VIDEO_AGENT_NAME || agentName === VIDEO_ASYNC_AGENT_NAME)) {
      setTimeout(() => {
        syncVideoNodeStatusToStoryboard(nodeId, phase, error);
      }, 0);
    }
  };

  window.addEventListener("node-agent-event", handler as EventListener);

  // 返回清理函数
  return () => {
    window.removeEventListener("node-agent-event", handler as EventListener);
  };
}
