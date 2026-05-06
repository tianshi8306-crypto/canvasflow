import { useCallback, useEffect, useRef } from "react";
import { getVideoJobViaBridge } from "@/lib/videoGeneration";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { videoGenerationAgentRuntime } from "@/lib/nodeAgentRuntime/videoGenerationAgent";
import { videoAsyncTaskAgentRuntime, type VideoAsyncConfig } from "@/lib/nodeAgentRuntime/videoAsyncTaskAgent";
import { defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { useProjectStore } from "@/store/projectStore";

/**
 * 视频节点：提交生成任务并轮询 `activeJob`，完成后写回 `path`（若有 resultRelPath）。
 */
export function useVideoNodeGeneration(videoNodeId: string | undefined) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const videoBlock = useProjectStore((s) =>
    videoNodeId ? s.nodes.find((n) => n.id === videoNodeId)?.data.video : undefined,
  );
  const activeJob = videoBlock?.activeJob;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startGeneration = useCallback(async () => {
    if (!videoNodeId) {
      setStatusText("请通过视频节点提交生成任务");
      return;
    }
    if (!projectPath) {
      setStatusText("请先打开工程");
      return;
    }
    const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
    const vb = node?.data.video ?? defaultVideoNodePersisted();
    const asyncCfg = (node?.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>).videoAsync
      : undefined) as unknown;

    try {
      if (asyncCfg && typeof asyncCfg === "object") {
        await runNodeTaskAgent(
          videoAsyncTaskAgentRuntime,
          { config: asyncCfg as VideoAsyncConfig },
          { nodeId: videoNodeId, projectPath, updateNodeData, setStatusText },
        );
      } else {
        await runNodeTaskAgent(
          videoGenerationAgentRuntime,
          { videoBlock: vb },
          {
            nodeId: videoNodeId,
            projectPath,
            updateNodeData,
            setStatusText,
          },
        );
      }
    } catch {
      // runNodeTaskAgent 已统一写入失败状态
    }
  }, [projectPath, setStatusText, updateNodeData, videoNodeId]);

  useEffect(() => {
    if (!videoNodeId || !activeJob?.id) {
      clearPoll();
      return;
    }
    const st = activeJob.status;
    if (st !== "queued" && st !== "running") {
      clearPoll();
      return;
    }

    const tick = async () => {
      try {
        const snap = await getVideoJobViaBridge(activeJob.id);
        const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
        const vb0 = node?.data.video;
        if (!vb0) return;

        if (snap.status === "queued" || snap.status === "running") {
          updateNodeData(videoNodeId, {
            video: {
              ...vb0,
              activeJob: {
                id: snap.id,
                status: snap.status,
                progress: snap.progress,
                modelId: snap.modelId,
                error: snap.error ?? null,
                startedAt: vb0.activeJob?.startedAt,
              },
            },
          });
          return;
        }

        if (snap.status === "succeeded") {
          clearPoll();
          const rel = snap.resultRelPath?.trim();
          const source = snap.source ?? "bridge";
          updateNodeData(videoNodeId, {
            ...(rel ? { path: rel } : {}),
            video: {
              ...vb0,
              source: "generation",
              activeJob: undefined,
            },
          });
          setStatusText(
            rel
              ? `生成完成，已写入视频节点（${source === "mock" ? "mock 模式" : "bridge 模式"}）`
              : source === "mock"
                ? "生成完成（mock 模式：未返回落盘路径）"
                : "生成完成（bridge 模式：后端未返回落盘路径，请检查 video_gen_get_job）",
          );
          return;
        }

        if (snap.status === "failed" || snap.status === "cancelled") {
          clearPoll();
          updateNodeData(videoNodeId, {
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
          setStatusText(snap.error ?? "视频生成失败");
        }
      } catch (e) {
        clearPoll();
        setStatusText(`轮询失败：${e instanceof Error ? e.message : String(e)}`);
      }
    };

    pollRef.current = setInterval(() => {
      void tick();
    }, 1500);
    void tick();

    return () => clearPoll();
  }, [activeJob?.id, activeJob?.status, clearPoll, setStatusText, updateNodeData, videoNodeId]);

  const busy = Boolean(activeJob?.status === "queued" || activeJob?.status === "running");

  return { startGeneration, busy, activeJob };
}
