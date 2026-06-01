import { useCallback, useEffect, useRef, useState } from "react";
import { cancelVideoJobViaBridge, getVideoJobViaBridge, recoverDreaminaVideoViaBridge } from "@/lib/videoGeneration";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import { refreshDreaminaAuthOnGenerationFailure } from "@/lib/dreaminaAuthOnFailure";
import { videoGenerationAgentRuntime } from "@/lib/nodeAgentRuntime/videoGenerationAgent";
import { videoAsyncTaskAgentRuntime, type VideoAsyncConfig } from "@/lib/nodeAgentRuntime/videoAsyncTaskAgent";
import { normalizeVideoJobProgress } from "@/lib/video/normalizeVideoJobProgress";
import { defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import { normalizeLoadedSettings } from "@/lib/settingsPanelState";
import { getVideoModelReadinessError } from "@/lib/videoModelReadiness";
import { listSelectableVideoModelIds } from "@/lib/videoModelMerge";
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

  // 缓存 Settings 中的有效模型 ID
  const [validModelIds, setValidModelIds] = useState<string[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        const raw = await invoke<AppSettings>("load_settings");
        const settings = normalizeLoadedSettings(raw);
        setValidModelIds(listSelectableVideoModelIds(settings));
      } catch {
        setValidModelIds([]);
      }
    })();
  }, []);

  /** 若当前 modelId 不在 Settings 有效模型中，自动替换为第一个有效值 */
  const resolveModelId = useCallback(
    (modelId: string): string => {
      if (validModelIds.includes(modelId)) return modelId;
      return validModelIds[0] ?? modelId;
    },
    [validModelIds],
  );

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

    // 若当前 modelId 在 Settings 有效模型列表中不存在，自动替换
    const resolvedModelId = resolveModelId(vb.draft.modelId);
    const videoBlockWithResolvedModel: typeof vb =
      resolvedModelId !== vb.draft.modelId
        ? { ...vb, draft: { ...vb.draft, modelId: resolvedModelId } }
        : vb;

    const readinessErr = await getVideoModelReadinessError(videoBlockWithResolvedModel.draft.modelId);
    if (readinessErr) {
      setStatusText(readinessErr);
      updateNodeData(videoNodeId, {
        video: {
          ...videoBlockWithResolvedModel,
          activeJob: {
            id: "",
            status: "failed",
            error: readinessErr,
            modelId: videoBlockWithResolvedModel.draft.modelId,
          },
        },
      });
      return;
    }

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
          { videoBlock: videoBlockWithResolvedModel },
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
  }, [projectPath, resolveModelId, setStatusText, updateNodeData, videoNodeId]);

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
          const polledProgress = normalizeVideoJobProgress(snap.progress);
          updateNodeData(videoNodeId, {
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
          });
          return;
        }

        if (snap.status === "succeeded") {
          clearPoll();
          const rel = snap.resultRelPath?.trim();
          const source = snap.source ?? "bridge";
          updateNodeData(videoNodeId, {
            ...(rel ? { path: rel } : {}),
            status: undefined,
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
          if (snap.status === "failed") {
            refreshDreaminaAuthOnGenerationFailure(snap.modelId);
          }
          clearPoll();
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

  const cancelGeneration = useCallback(async () => {
    if (!videoNodeId || !activeJob?.id) return;
    const jobId = activeJob.id;
    setCancelling(true);
    try {
      clearPoll();
      await cancelVideoJobViaBridge(jobId);
      const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
      const vb0 = node?.data.video;
      if (!vb0) return;
      updateNodeData(videoNodeId, {
        status: undefined,
        video: {
          ...vb0,
          activeJob: {
            id: jobId,
            status: "cancelled",
            modelId: activeJob.modelId,
            error: null,
          },
        },
      });
      setStatusText("已取消视频生成");
    } catch (e) {
      setStatusText(`取消失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCancelling(false);
    }
  }, [activeJob?.id, activeJob?.modelId, clearPoll, setStatusText, updateNodeData, videoNodeId]);

  const recoverDreaminaVideo = useCallback(
    async (submitId: string) => {
      if (!videoNodeId || !projectPath) {
        setStatusText("请先打开工程");
        return;
      }
      const trimmed = submitId.trim();
      if (!trimmed) {
        setStatusText("缺少即梦 submit_id，无法取回");
        return;
      }
      const node = useProjectStore.getState().nodes.find((n) => n.id === videoNodeId);
      const vb0 = node?.data.video ?? defaultVideoNodePersisted();
      setRecovering(true);
      try {
        const snap = await recoverDreaminaVideoViaBridge({
          projectPath,
          nodeId: videoNodeId,
          submitId: trimmed,
          modelId: vb0.draft.modelId,
          workflow: vb0.draft.workflow,
        });
        if (snap.status === "succeeded" && snap.resultRelPath?.trim()) {
          const rel = snap.resultRelPath.trim();
          updateNodeData(videoNodeId, {
            path: rel,
            status: undefined,
            video: {
              ...vb0,
              source: "generation",
              activeJob: undefined,
            },
          });
          setStatusText("已从即梦取回成片并写入视频节点");
          return;
        }
        if (snap.status === "running" || snap.status === "queued") {
          updateNodeData(videoNodeId, {
            video: {
              ...vb0,
              activeJob: {
                id: trimmed,
                status: snap.status === "queued" ? "queued" : "running",
                modelId: vb0.draft.modelId,
                error: snap.error ?? null,
                startedAt: new Date().toISOString(),
              },
            },
          });
          setStatusText(snap.error ?? "即梦任务仍在处理，请稍后再试取回");
          return;
        }
        updateNodeData(videoNodeId, {
          status: undefined,
          video: {
            ...vb0,
            activeJob: {
              id: trimmed,
              status: "failed",
              modelId: vb0.draft.modelId,
              error: snap.error ?? "取回即梦成片失败",
            },
          },
        });
        setStatusText(snap.error ?? "取回即梦成片失败");
      } catch (e) {
        setStatusText(`取回失败：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setRecovering(false);
      }
    },
    [projectPath, setStatusText, updateNodeData, videoNodeId],
  );

  const busy = Boolean(activeJob?.status === "queued" || activeJob?.status === "running");

  return { startGeneration, cancelGeneration, recoverDreaminaVideo, busy, cancelling, recovering, activeJob };
}
