import { refreshDreaminaAuthOnGenerationFailure } from "@/lib/dreaminaAuthOnFailure";
import { autoDelogoVideo } from "@/lib/videoGeneration/autoDelogo";
import { getVideoJobViaBridge } from "@/lib/videoGeneration";
import {
  shouldFailVideoJobAsStuck,
  stuckVideoJobErrorMessage,
  type StuckTrackState,
} from "@/lib/videoGeneration/videoJobStuckDetection";
import { normalizeVideoJobProgress } from "@/lib/video/normalizeVideoJobProgress";
import { applyIncomingComposeClipSync } from "@/lib/compose";
import { commitGeneratedMediaPatchForProject } from "@/lib/nodeMediaRef";
import { defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { useProjectStore } from "@/store/projectStore";
import { flushProjectSave } from "@/store/projectSaveDebounce";
import {
  isActiveVideoJobInProgress,
  nodeHasSatisfiedLocalVideo,
  patchClearStaleActiveJob,
} from "@/lib/videoGeneration/videoNodeLocalSatisfaction";

export type VideoNodePollResult = "pending" | "succeeded" | "failed" | "cancelled" | "idle";

const stuckByNode = new Map<string, StuckTrackState>();

function resetStuck(videoNodeId: string) {
  stuckByNode.delete(videoNodeId);
}

function parseJobStartedAtMs(startedAt: string | undefined, fallbackMs: number): number {
  if (!startedAt?.trim()) return fallbackMs;
  const parsed = Date.parse(startedAt);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

/**
 * 对单个视频节点执行一次任务轮询并写回 store（不依赖面板是否打开）。
 */
export async function pollVideoNodeJobOnce(videoNodeId: string): Promise<VideoNodePollResult> {
  const { projectPath, updateNodeData, setStatusText } = useProjectStore.getState();
  const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
  const vb0 = node?.data.video ?? defaultVideoNodePersisted();
  const job = vb0.activeJob;

  if (!job?.id) {
    resetStuck(videoNodeId);
    if (node?.data.path?.trim() || node?.data.assetId?.trim()) return "succeeded";
    return "idle";
  }

  if (node && nodeHasSatisfiedLocalVideo(node.data)) {
    resetStuck(videoNodeId);
    updateNodeData(videoNodeId, {
      video: patchClearStaleActiveJob(vb0),
    });
    await flushProjectSave(() => useProjectStore.getState());
    return "succeeded";
  }

  if (job.status !== "queued" && job.status !== "running") {
    resetStuck(videoNodeId);
    if (job.status === "failed") return "failed";
    if (job.status === "cancelled") return "cancelled";
    if (node?.data.path?.trim()) return "succeeded";
    return "failed";
  }

  try {
    const draft = vb0.draft;
    let snap = await getVideoJobViaBridge(job.id, {
      projectPath: projectPath ?? "",
      nodeId: videoNodeId,
      modelId: job.modelId ?? draft?.modelId ?? "",
      workflow: draft?.workflow,
    });

    if (
      snap.resultRelPath?.trim() &&
      snap.status !== "failed" &&
      snap.status !== "cancelled"
    ) {
      snap = { ...snap, status: "succeeded" };
    }

    if (snap.status === "queued" || snap.status === "running") {
      const polledProgress = normalizeVideoJobProgress(snap.progress);
      const nowMs = Date.now();
      const jobStartedAtMs = parseJobStartedAtMs(
        vb0.activeJob?.startedAt,
        nowMs,
      );
      const stuckCheck = shouldFailVideoJobAsStuck({
        prev: stuckByNode.get(videoNodeId),
        status: snap.status,
        progress: polledProgress,
        jobStartedAtMs,
        nowMs,
      });
      stuckByNode.set(videoNodeId, stuckCheck.next);

      if (stuckCheck.fail) {
        resetStuck(videoNodeId);
        const stuckMsg = stuckVideoJobErrorMessage(snap.modelId ?? draft?.modelId);
        refreshDreaminaAuthOnGenerationFailure(snap.modelId);
        updateNodeData(videoNodeId, {
          status: undefined,
          video: {
            ...vb0,
            activeJob: {
              id: snap.id,
              status: "failed",
              modelId: snap.modelId,
              error: stuckMsg,
            },
          },
        });
        await flushProjectSave(() => useProjectStore.getState());
        setStatusText(stuckMsg);
        import("@/lib/systemNotify").then((m) => {
          void m.notifyTaskFailure("视频", stuckMsg);
        });
        return "failed";
      }

      updateNodeData(
        videoNodeId,
        {
          video: {
            ...vb0,
            activeJob: {
              id: snap.id,
              status: snap.status,
              ...(polledProgress != null ? { progress: polledProgress } : {}),
              modelId: snap.modelId,
              error: snap.error ?? null,
              startedAt: vb0.activeJob?.startedAt,
            },
          },
        },
        { silent: true },
      );
      return "pending";
    }

    resetStuck(videoNodeId);

    if (snap.status === "succeeded") {
      const rel = snap.resultRelPath?.trim();
      const source = snap.source ?? "bridge";
      const mediaPatch = rel
        ? await commitGeneratedMediaPatchForProject(projectPath, rel)
        : {};
      updateNodeData(videoNodeId, {
        ...mediaPatch,
        status: undefined,
        video: {
          ...vb0,
          source: "generation",
          awaitingNewResult: false,
          activeJob: undefined,
        },
      });
      await flushProjectSave(() => useProjectStore.getState());

      if (rel && projectPath) {
        const { nodes: graphNodes, edges: graphEdges } = useProjectStore.getState();
        for (const edge of graphEdges) {
          if (edge.source !== videoNodeId) continue;
          const target = graphNodes.find((n) => n.id === edge.target);
          if (target?.type !== "ffmpegConcat") continue;
          void applyIncomingComposeClipSync(
            edge.target,
            videoNodeId,
            projectPath,
            graphNodes,
            graphEdges,
            { updateNodeData, setStatusText },
            { quiet: true },
          );
        }
      }

      setStatusText(
        rel
          ? `生成完成，已写入视频节点（${source === "mock" ? "mock 模式" : "bridge 模式"}）`
          : source === "mock"
            ? "生成完成（mock 模式：未返回落盘路径）"
            : "生成完成（bridge 模式：后端未返回落盘路径，请检查 video_gen_get_job）",
      );
      import("@/lib/systemNotify").then((m) => {
        void m.notifyTaskSuccess("视频", rel ? "视频已就绪" : "生成完成（未返回路径）");
      });

      if (rel && projectPath) {
        const draft = vb0.draft;
        const noSubtitles = draft?.output?.noSubtitles === true;
        const modelId = draft?.modelId;
        const isSeedanceLike =
          modelId === "doubao_seedance_2_0" ||
          modelId === "doubao_seedance_2_0_pro" ||
          modelId?.startsWith("doubao_seedance");

        if (noSubtitles && isSeedanceLike) {
          void (async () => {
            try {
              setStatusText("生成完成，正在自动移除字幕…");
              const cleaned = await autoDelogoVideo(projectPath, rel);
              const cleanedPatch = await commitGeneratedMediaPatchForProject(
                projectPath,
                cleaned.relPath,
              );
              updateNodeData(videoNodeId, {
                ...cleanedPatch,
                status: undefined,
              });
              await flushProjectSave(() => useProjectStore.getState());
              setStatusText("生成完成，字幕已自动移除");
            } catch {
              setStatusText("生成完成（自动去字幕失败，已保留原视频）");
            }
          })();
        }
      }

      return "succeeded";
    }

    if (snap.status === "failed" || snap.status === "cancelled") {
      if (snap.status === "failed") {
        refreshDreaminaAuthOnGenerationFailure(snap.modelId);
      }
      updateNodeData(videoNodeId, {
        status: undefined,
        video: {
          ...vb0,
          activeJob: {
            id: snap.id,
            status: snap.status,
            modelId: snap.modelId,
            error: snap.error ?? "任务失败",
          },
        },
      });
      await flushProjectSave(() => useProjectStore.getState());
      setStatusText(snap.error ?? "视频生成失败");
      import("@/lib/systemNotify").then((m) => {
        void m.notifyTaskFailure(
          "视频",
          snap.status === "cancelled" ? "任务已取消" : (snap.error ?? "生成失败"),
        );
      });
      return snap.status === "cancelled" ? "cancelled" : "failed";
    }

    return "pending";
  } catch (e) {
    resetStuck(videoNodeId);
    const errMsg = e instanceof Error ? e.message : String(e);
    setStatusText(`轮询失败：${errMsg}`);
    refreshDreaminaAuthOnGenerationFailure(vb0.activeJob?.modelId ?? "doubao_seedance_2_0");
    updateNodeData(videoNodeId, {
      status: undefined,
      video: {
        ...vb0,
        activeJob: {
          id: vb0.activeJob!.id,
          status: "failed",
          modelId: vb0.activeJob!.modelId ?? "doubao_seedance_2_0",
          error: `轮询异常：${errMsg}`,
          startedAt: vb0.activeJob!.startedAt,
        },
      },
    });
    await flushProjectSave(() => useProjectStore.getState());
    import("@/lib/systemNotify").then((m) => {
      void m.notifyTaskFailure("视频", `轮询异常：${errMsg}`);
    });
    return "failed";
  }
}

/** 列出当前需要轮询的视频节点 id */
export function listVideoNodesWithActiveJobs(
  nodes: {
    id: string;
    type?: string;
    data: {
      path?: string;
      assetId?: string;
      video?: {
        awaitingNewResult?: boolean;
        activeJob?: { status?: string };
      };
    };
  }[],
): string[] {
  return nodes
    .filter((n) => n.type === "videoNode")
    .filter((n) => !nodeHasSatisfiedLocalVideo(n.data))
    .filter((n) => isActiveVideoJobInProgress(n.data.video?.activeJob))
    .map((n) => n.id);
}
