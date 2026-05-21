import type { Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { useProjectStore } from "@/store/projectStore";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { videoGenerationAgentRuntime } from "@/lib/nodeAgentRuntime/videoGenerationAgent";
import type { VideoNodePersisted } from "@/lib/videoNodeTypes";
import {
  findImageNodesForScript,
  findVideoNodesForScript,
  shotHasGeneratedImage,
} from "@/lib/storyboard/storyboardMediaNodes";
import { patchStoryboardShot } from "@/lib/storyboard/patchStoryboardShot";
import { ensureVideoDraftReferencesFromUpstream } from "@/lib/storyboard/syncVideoDraftFromChainImage";
import {
  autoComposePreviewAfterBatchVideo,
  videoNodeIdsForBeats,
} from "@/lib/storyboard/autoComposePreviewAfterBatch";

export { findVideoNodesForScript, findImageNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";

export type BatchVideoResult = { started: number; skipped: number; failed: number };

/**
 * 为已有分镜图、且存在对应 videoNode 的镜头批量提交视频生成。
 * 支持 script→image→video 建链布局；提交前同步上游图片到 video draft。
 */
export async function batchGenerateVideosForStoryboard(opts: {
  scriptNodeId: string;
  beats: ScriptBeat[];
  shots: StoryboardShot[];
  nodes: Node<FlowNodeData>[];
  edges: { source: string; target: string }[];
  projectPath: string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  setStatusText: (t: string) => void;
  beatIds?: string[];
  onProgress?: (current: number, total: number, shotNumber: string) => void;
  /** 提交完成后等待落盘并打开成片合成预览（默认读取 localStorage 偏好） */
  autoComposePreview?: boolean;
}): Promise<BatchVideoResult> {
  const {
    scriptNodeId,
    shots,
    beats,
    nodes,
    edges,
    projectPath,
    updateNodeData,
    setStatusText,
    beatIds,
    onProgress,
    autoComposePreview,
  } = opts;

  const videoByBeat = findVideoNodesForScript(scriptNodeId, nodes, edges);
  const imageByBeat = findImageNodesForScript(scriptNodeId, nodes, edges);
  const beatFilter = beatIds?.length ? new Set(beatIds) : null;
  let started = 0;
  let skipped = 0;
  let failed = 0;
  const startedBeatIds: string[] = [];

  const eligible = shots.filter((s) => {
    if (beatFilter && !beatFilter.has(s.scriptBeatId)) return false;
    if (!s.visualPrompt?.trim()) return false;
    if (s.status === "failed") return false;
    if (s.videoStatus === "generating" || s.videoStatus === "generated") return false;
    if (!videoByBeat.has(s.scriptBeatId)) return false;
    const imageNode = nodes.find((n) => n.id === imageByBeat.get(s.scriptBeatId));
    return shotHasGeneratedImage(s.scriptBeatId, s, imageNode);
  });

  if (eligible.length === 0) {
    setStatusText(
      "没有可批量生成的视频（需分镜文案、分镜图已出片，且已创建视频节点；图+视频建链可用）",
    );
    return { started: 0, skipped: shots.length, failed: 0 };
  }

  const total = eligible.length;
  setStatusText(`批量视频：开始提交 ${total} 个镜头…`);

  for (let i = 0; i < eligible.length; i++) {
    const shot = eligible[i]!;
    const videoNodeId = videoByBeat.get(shot.scriptBeatId)!;
    const beat = useProjectStore
      .getState()
      .nodes.find((n) => n.id === scriptNodeId)
      ?.data.scriptBeats?.find((b) => b.id === shot.scriptBeatId);
    const shotLabel = beat?.shotNumber?.trim() || String(i + 1);
    onProgress?.(i + 1, total, shotLabel);

    const latestNodes = useProjectStore.getState().nodes;
    const latestEdges = useProjectStore.getState().edges;

    await ensureVideoDraftReferencesFromUpstream({
      videoNodeId,
      nodes: latestNodes,
      edges: latestEdges,
      projectPath,
      updateNodeData,
    });

    const videoNode = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
    const videoBlock = videoNode?.data.video as VideoNodePersisted | undefined;
    if (!videoBlock?.draft?.prompt?.trim()) {
      skipped += 1;
      setStatusText(`批量视频：镜 ${shotLabel} 跳过（无视频草稿 prompt）`);
      continue;
    }

    setStatusText(`批量视频：${i + 1}/${total} 镜 ${shotLabel}…`);

    patchStoryboardShot(
      scriptNodeId,
      shot.scriptBeatId,
      { videoStatus: "generating", videoError: undefined },
      updateNodeData,
    );

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
      startedBeatIds.push(shot.scriptBeatId);
    } catch {
      failed += 1;
      patchStoryboardShot(
        scriptNodeId,
        shot.scriptBeatId,
        { videoStatus: "failed", videoError: "批量视频生成失败" },
        updateNodeData,
      );
    }
  }

  setStatusText(
    `批量视频：已提交 ${started} 个` +
      (skipped ? `，跳过 ${skipped}` : "") +
      (failed ? `，失败 ${failed}` : ""),
  );

  if (started > 0 && autoComposePreview !== false) {
    const videoIds = videoNodeIdsForBeats(
      scriptNodeId,
      startedBeatIds,
      useProjectStore.getState().nodes,
      useProjectStore.getState().edges,
    );
    void autoComposePreviewAfterBatchVideo({
      scriptNodeId,
      beats,
      shots,
      beatIds: startedBeatIds,
      videoNodeIds: videoIds,
      setStatusText,
      enabled: autoComposePreview,
    });
  }

  return { started, skipped, failed };
}
