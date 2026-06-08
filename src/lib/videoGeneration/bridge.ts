import { invoke } from "@tauri-apps/api/core";
import {
  getVideoGenerationClient,
  type VideoGenerationStartRequest,
  type VideoJobPollHint,
  type VideoJobSnapshot,
} from "@/lib/videoGeneration/apiPool";
import { resolveVideoGenerationMode } from "@/lib/videoGeneration/mode";

/**
 * 与 Tauri 后端约定的命令名（Rust 侧实现同名 command 即可对接真实供应商）。
 *
 * ```ignore
 * video_gen_start   -> { jobId: string }
 * video_gen_get_job -> VideoJobSnapshot
 * video_gen_cancel  -> ()
 * ```
 *
 * 模式说明：
 * - bridge: 仅调用 Tauri 命令（失败即抛错，不回退）
 * - mock:   仅调用本地 Mock client
 * - auto:   先调 Tauri 命令，失败后回退 Mock client
 */
async function tryInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<{ value: T | null; error: unknown | null }> {
  try {
    return { value: await invoke<T>(cmd, args), error: null };
  } catch (error) {
    return { value: null, error };
  }
}

export async function startVideoGenerationViaBridge(req: VideoGenerationStartRequest) {
  const mode = resolveVideoGenerationMode();
  if (mode === "mock") return getVideoGenerationClient().startJob(req);
  const r = await tryInvoke<{ jobId: string }>("video_gen_start", { req });
  if (r.value) return r.value;
  if (mode === "bridge") {
    throw new Error(`video_gen_start 调用失败（bridge 模式，不允许回退 mock）：${String(r.error)}`);
  }
  return getVideoGenerationClient().startJob(req);
}

export async function getVideoJobViaBridge(
  jobId: string,
  hint?: VideoJobPollHint | null,
): Promise<VideoJobSnapshot> {
  const mode = resolveVideoGenerationMode();
  if (mode === "mock") return getVideoGenerationClient().getJob(jobId);
  const r = await tryInvoke<VideoJobSnapshot>("video_gen_get_job", {
    jobId,
    hint: hint ?? null,
  });
  if (r.value) return { ...r.value, source: "bridge" };
  if (mode === "bridge") {
    throw new Error(`video_gen_get_job 调用失败（bridge 模式，不允许回退 mock）：${String(r.error)}`);
  }
  return getVideoGenerationClient().getJob(jobId);
}

export async function cancelVideoJobViaBridge(jobId: string) {
  const mode = resolveVideoGenerationMode();
  if (mode === "mock") {
    await getVideoGenerationClient().cancelJob(jobId);
    return;
  }
  const ok = await tryInvoke<void>("video_gen_cancel", { jobId });
  if (ok.value !== null) return;
  if (mode === "bridge") {
    throw new Error(`video_gen_cancel 调用失败（bridge 模式，不允许回退 mock）：${String(ok.error)}`);
  }
  await getVideoGenerationClient().cancelJob(jobId);
}

export type DreaminaVideoRecoverRequest = {
  projectPath: string;
  nodeId: string;
  submitId: string;
  modelId: string;
  workflow?: string;
};

export async function recoverDreaminaVideoViaBridge(
  req: DreaminaVideoRecoverRequest,
): Promise<VideoJobSnapshot> {
  const mode = resolveVideoGenerationMode();
  if (mode === "mock") {
    throw new Error("mock 模式不支持即梦成片取回");
  }
  const r = await tryInvoke<VideoJobSnapshot>("video_gen_recover_dreamina", {
    req: {
      projectPath: req.projectPath,
      nodeId: req.nodeId,
      submitId: req.submitId,
      modelId: req.modelId,
      workflow: req.workflow,
    },
  });
  if (r.value) return { ...r.value, source: "bridge" };
  throw new Error(`即梦成片取回失败：${String(r.error)}`);
}
