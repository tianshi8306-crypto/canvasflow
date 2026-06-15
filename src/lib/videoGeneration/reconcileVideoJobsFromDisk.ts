import { invoke, isTauri } from "@tauri-apps/api/core";
import { commitGeneratedMediaPatchForProject } from "@/lib/nodeMediaRef";
import { defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import { useProjectStore } from "@/store/projectStore";
import { recoverDreaminaVideoViaBridge } from "@/lib/videoGeneration/bridge";
import {
  listVideoNodesWithActiveJobs,
  pollVideoNodeJobOnce,
} from "@/lib/videoGeneration/videoNodeJobPoll";
import { flushProjectSave } from "@/store/projectSaveDebounce";
import {
  buildRestoredActiveJob,
  type PersistedVideoJobEntry,
  pickDiskJobForNode,
  shouldKeepInMemoryActiveJob,
  shouldSkipVideoJobReconcile,
} from "@/lib/videoGeneration/reconcileVideoJobsLogic";
import {
  isActiveVideoJobInProgress,
  nodeHasSatisfiedLocalVideo,
  patchClearStaleActiveJob,
} from "@/lib/videoGeneration/videoNodeLocalSatisfaction";

async function listPersistedVideoJobs(projectPath: string): Promise<PersistedVideoJobEntry[]> {
  if (!isTauri()) return [];
  try {
    return await invoke<PersistedVideoJobEntry[]>("video_gen_list_persisted_jobs", {
      projectPath,
    });
  } catch {
    return [];
  }
}

async function tryRecoverDreaminaDiskJob(
  projectPath: string,
  nodeId: string,
  diskJob: PersistedVideoJobEntry,
): Promise<boolean> {
  if (!diskJob.isDreamina || diskJob.cancelled || diskJob.resultRelPath?.trim()) {
    return false;
  }
  try {
    const snap = await recoverDreaminaVideoViaBridge({
      projectPath,
      nodeId,
      submitId: diskJob.jobId,
      modelId: diskJob.modelId,
      workflow: diskJob.dreaminaWorkflow ?? undefined,
    });
    const rel = snap.resultRelPath?.trim();
    if (snap.status !== "succeeded" || !rel) return false;

    const node = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
    const vb = node?.data.video ?? defaultVideoNodePersisted();
    const mediaPatch = await commitGeneratedMediaPatchForProject(projectPath, rel);
    useProjectStore.getState().updateNodeData(nodeId, {
      ...mediaPatch,
      status: undefined,
      video: {
        ...vb,
        source: "generation",
        activeJob: undefined,
      },
    });
    await flushProjectSave(() => useProjectStore.getState());
    useProjectStore.getState().setStatusText("已从即梦取回视频成片并写入节点");
    return true;
  } catch {
    return false;
  }
}

/**
 * 工程打开后：用 `.canvasflow/video-jobs` 与节点 activeJob 对账，恢复丢失的进行中任务并触发轮询。
 */
export async function reconcileVideoJobsFromDisk(projectPath: string): Promise<void> {
  const trimmed = projectPath.trim();
  if (!trimmed) return;

  const entries = await listPersistedVideoJobs(trimmed);
  if (entries.length === 0) return;

  const store = useProjectStore.getState();
  const { nodes, updateNodeData } = store;

  for (const node of nodes) {
    if (node.type !== "videoNode") continue;

    const vb = node.data.video ?? defaultVideoNodePersisted();

    if (nodeHasSatisfiedLocalVideo(node.data)) {
      if (isActiveVideoJobInProgress(vb.activeJob)) {
        updateNodeData(node.id, {
          video: patchClearStaleActiveJob(vb),
        });
        await flushProjectSave(() => useProjectStore.getState());
      }
      continue;
    }

    const diskJob = pickDiskJobForNode(node.id, entries);
    if (!diskJob) continue;

    if (
      diskJob.isDreamina &&
      !diskJob.cancelled &&
      !diskJob.resultRelPath?.trim() &&
      !nodeHasSatisfiedLocalVideo(node.data)
    ) {
      const recovered = await tryRecoverDreaminaDiskJob(trimmed, node.id, diskJob);
      if (recovered) continue;
    }

    if (shouldSkipVideoJobReconcile(node, diskJob)) continue;
    if (shouldKeepInMemoryActiveJob(node, diskJob, entries)) continue;

    const hasExistingOutput = Boolean(node.data.path?.trim() || node.data.assetId?.trim());
    updateNodeData(node.id, {
      video: {
        ...vb,
        awaitingNewResult: hasExistingOutput,
        activeJob: buildRestoredActiveJob(
          diskJob,
          vb.activeJob?.startedAt,
          vb.draft?.modelId,
        ),
      },
    });
  }

  const toPoll = listVideoNodesWithActiveJobs(useProjectStore.getState().nodes);
  for (const nodeId of toPoll) {
    void pollVideoNodeJobOnce(nodeId);
  }
}
