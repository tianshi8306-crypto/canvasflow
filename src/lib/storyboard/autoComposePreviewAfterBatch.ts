import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import { waitForVideoNodesJobs } from "@/lib/videoGeneration/pollVideoNodeJob";
import { useProjectStore } from "@/store/projectStore";
import {
  assessComposeExportScope,
  formatComposeExportReadinessHint,
} from "@/lib/storyboard/scriptProductionExport";
import { readAutoComposePreviewAfterBatchVideo } from "@/lib/storyboard/scriptProductionPrefs";
import { findVideoNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";
import { patchStoryboardShot } from "@/lib/storyboard/patchStoryboardShot";

export type AutoComposePreviewResult =
  | { ok: true; autoRender: boolean; readyCount: number; totalInScope: number }
  | { ok: false; reason: string };

/**
 * 批量视频提交后：轮询落盘 → 创建/更新合成节点并聚焦（预览）；若范围内均已出片则自动 FFmpeg 导出。
 */
export async function autoComposePreviewAfterBatchVideo(opts: {
  scriptNodeId: string;
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
  beatIds: string[];
  videoNodeIds: string[];
  setStatusText: (t: string) => void;
  enabled?: boolean;
}): Promise<AutoComposePreviewResult> {
  if (opts.enabled === false || !readAutoComposePreviewAfterBatchVideo()) {
    return { ok: false, reason: "已关闭批量后自动合成预览" };
  }
  if (opts.videoNodeIds.length === 0) {
    return { ok: false, reason: "无视频节点可等待" };
  }

  const state = useProjectStore.getState();
  if (!state.projectPath?.trim()) {
    return { ok: false, reason: "未打开工程" };
  }

  opts.setStatusText(`批量视频：等待 ${opts.videoNodeIds.length} 个镜头落盘…`);

  const waitResult = await waitForVideoNodesJobs(opts.videoNodeIds, {
    onProgress: (done, total) => {
      if (done < total) {
        opts.setStatusText(`批量视频：落盘进度 ${done}/${total}…`);
      }
    },
  });

  const scriptNode = useProjectStore.getState().nodes.find(
    (n) => n.id === opts.scriptNodeId && n.type === "scriptNode",
  );
  if (!scriptNode) return { ok: false, reason: "未找到脚本节点" };

  for (const videoNodeId of waitResult.succeeded) {
    const videoNode = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
    const beatId =
      videoNode?.data.params &&
      typeof videoNode.data.params === "object" &&
      typeof (videoNode.data.params as { scriptBeatId?: string }).scriptBeatId === "string"
        ? (videoNode.data.params as { scriptBeatId: string }).scriptBeatId
        : null;
    if (beatId) {
      patchStoryboardShot(
        opts.scriptNodeId,
        beatId,
        { videoStatus: "generated", videoNodeId, videoError: undefined },
        state.updateNodeData,
      );
    }
  }

  const latest = useProjectStore.getState();
  const readiness = assessComposeExportScope({
    scriptNodeId: opts.scriptNodeId,
    beats: opts.beats,
    shots: scriptNode.data.storyboardShots ?? opts.shots,
    nodes: latest.nodes,
    edges: latest.edges,
    scriptBeatSelection: opts.beatIds,
  });

  if (!("canExport" in readiness) || !readiness.canExport) {
    const failParts = [
      waitResult.failed.length ? `失败 ${waitResult.failed.length}` : "",
      waitResult.timedOut.length ? `超时 ${waitResult.timedOut.length}` : "",
    ].filter(Boolean);
    return {
      ok: false,
      reason:
        "canExport" in readiness
          ? readiness.blockMessage
          : readiness.message + (failParts.length ? `（${failParts.join("，")}）` : ""),
    };
  }

  const exportBeatIds = readiness.scope.beats.map((b) => b.id);
  const allReady =
    readiness.readyCount === readiness.totalInScope && readiness.missingCount === 0;

  const exportResult = await latest.exportScriptCompose(opts.scriptNodeId, {
    autoRender: allReady,
    beatIds: exportBeatIds,
  });

  if (!exportResult) {
    return { ok: false, reason: "合成导出未完成" };
  }

  if (exportResult.outputRelPath) {
    opts.setStatusText(
      `批量视频完成并已导出成片：${exportResult.outputRelPath}（${readiness.readyCount} 镜）`,
    );
  } else {
    opts.setStatusText(
      `批量视频完成；已打开成片合成预览（${readiness.readyCount}/${readiness.totalInScope} 镜）` +
        (waitResult.timedOut.length ? `；${waitResult.timedOut.length} 镜仍等待超时` : "") +
        `。${formatComposeExportReadinessHint(readiness)}`,
    );
  }

  return {
    ok: true,
    autoRender: allReady,
    readyCount: readiness.readyCount,
    totalInScope: readiness.totalInScope,
  };
}

/** 根据 beatIds 收集本次批量涉及的视频节点 id（含 script→image→video 链） */
export function videoNodeIdsForBeats(
  scriptNodeId: string,
  beatIds: string[],
  nodes: Parameters<typeof findVideoNodesForScript>[1],
  edges: Parameters<typeof findVideoNodesForScript>[2],
): string[] {
  const filter = new Set(beatIds);
  const byBeat = findVideoNodesForScript(scriptNodeId, nodes, edges);
  return [...byBeat.entries()]
    .filter(([beatId]) => filter.has(beatId))
    .map(([, id]) => id);
}
