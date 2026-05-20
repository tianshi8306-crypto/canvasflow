import type { Node } from "@xyflow/react";
import type { FlowNodeData, StoryboardShot } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { videoGenerationAgentRuntime } from "@/lib/nodeAgentRuntime/videoGenerationAgent";
import type { VideoNodePersisted } from "@/lib/videoNodeTypes";
import { getScriptBeatIdFromParams } from "@/lib/incomingScriptBinding";

function beatIdFromNode(data: FlowNodeData): string | null {
  const id = getScriptBeatIdFromParams(data);
  return id?.trim() ? id : null;
}

/** 从脚本节点下游查找已绑定 scriptBeatId 的 videoNode */
export function findVideoNodesForScript(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: { source: string; target: string }[],
): Map<string, string> {
  const byBeat = new Map<string, string>();
  const linkedIds = new Set(
    edges.filter((e) => e.source === scriptNodeId).map((e) => e.target),
  );
  for (const n of nodes) {
    if (n.type !== "videoNode" || !linkedIds.has(n.id)) continue;
    const beatId = beatIdFromNode(n.data);
    if (beatId && !byBeat.has(beatId)) byBeat.set(beatId, n.id);
  }
  return byBeat;
}

export type BatchVideoResult = { started: number; skipped: number; failed: number };

/**
 * 为已生成分镜图、且存在对应 videoNode 的镜头批量提交视频生成。
 */
export async function batchGenerateVideosForStoryboard(opts: {
  scriptNodeId: string;
  shots: StoryboardShot[];
  nodes: Node<FlowNodeData>[];
  edges: { source: string; target: string }[];
  projectPath: string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  setStatusText: (t: string) => void;
  /** 仅处理这些 beatId；空则处理全部 eligible */
  beatIds?: string[];
}): Promise<BatchVideoResult> {
  const { scriptNodeId, shots, nodes, edges, projectPath, updateNodeData, setStatusText, beatIds } =
    opts;

  const videoByBeat = findVideoNodesForScript(scriptNodeId, nodes, edges);
  const beatFilter = beatIds?.length ? new Set(beatIds) : null;

  let started = 0;
  let skipped = 0;
  let failed = 0;

  const eligible = shots.filter((s) => {
    if (beatFilter && !beatFilter.has(s.scriptBeatId)) return false;
    if (s.status !== "generated") return false;
    if (s.videoStatus === "generating" || s.videoStatus === "generated") return false;
    return videoByBeat.has(s.scriptBeatId);
  });

  if (eligible.length === 0) {
    setStatusText("没有可批量生成的视频（需分镜图已生成且已创建对应视频节点）");
    return { started: 0, skipped: shots.length, failed: 0 };
  }

  const markShotVideoStatus = (beatId: string, patch: Partial<StoryboardShot>) => {
    const scriptNode = useProjectStore.getState().nodes.find((n) => n.id === scriptNodeId);
    const list = [...(scriptNode?.data.storyboardShots ?? [])];
    const idx = list.findIndex((s) => s.scriptBeatId === beatId);
    if (idx === -1) return;
    list[idx] = { ...list[idx]!, ...patch };
    updateNodeData(scriptNodeId, { storyboardShots: list });
  };

  for (const shot of eligible) {
    const videoNodeId = videoByBeat.get(shot.scriptBeatId)!;
    const videoNode = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
    const videoBlock = videoNode?.data.video as VideoNodePersisted | undefined;
    if (!videoBlock?.draft?.prompt?.trim()) {
      skipped += 1;
      continue;
    }

    markShotVideoStatus(shot.scriptBeatId, { videoStatus: "generating", videoError: undefined });

    try {
      await runNodeTaskAgent(
        videoGenerationAgentRuntime,
        { videoBlock },
        {
          nodeId: videoNodeId,
          projectPath,
          updateNodeData,
          setStatusText,
        },
      );
      started += 1;
    } catch {
      failed += 1;
      markShotVideoStatus(shot.scriptBeatId, {
        videoStatus: "failed",
        videoError: "批量视频生成失败",
      });
    }
  }

  setStatusText(
    `批量视频：已提交 ${started} 个` +
      (skipped ? `，跳过 ${skipped}` : "") +
      (failed ? `，失败 ${failed}` : ""),
  );
  return { started, skipped, failed };
}
