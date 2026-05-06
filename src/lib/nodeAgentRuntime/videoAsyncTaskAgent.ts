import { invoke, isTauri } from "@tauri-apps/api/core";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";

type GenericAsyncSubmitReq = {
  url: string;
  method?: "POST" | "GET";
  headers: Record<string, string>;
  body: Record<string, unknown>;
  taskIdPointer: string;
};

type GenericAsyncPollReq = {
  url: string;
  method?: "POST" | "GET";
  headers: Record<string, string>;
  body: Record<string, unknown>;
  statusPointer: string;
  doneValue?: string;
  resultUrlPointer?: string;
  errorPointer?: string;
};

export type VideoAsyncConfig = {
  submit: GenericAsyncSubmitReq;
  poll: GenericAsyncPollReq;
  pollIntervalMs?: number;
  timeoutMs?: number;
  maxPoll?: number;
  /** 下载结果保存到 assets 的文件类型（默认 video） */
  kind?: "video" | "image" | "audio" | "file";
  sourceLabel?: string;
};

type Input = {
  config: VideoAsyncConfig;
};

type Sensed = {
  config: VideoAsyncConfig;
};

type Executed = {
  relPath: string;
  assetId?: string;
  taskId: string;
};

type Committed = Executed;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function ensurePlainObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function interpolateBody(template: Record<string, unknown>, vars: Record<string, string>): Record<string, unknown> {
  // MVP：只做字符串字段的 {{taskId}} 替换；嵌套对象不递归（需要时再扩展）
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(template)) {
    if (typeof v === "string") {
      out[k] = v.replaceAll("{{taskId}}", vars.taskId ?? "");
    } else {
      out[k] = v;
    }
  }
  return out;
}

function normalizeConfig(input: VideoAsyncConfig): VideoAsyncConfig {
  const cfg = input as VideoAsyncConfig;
  const pollIntervalMs = Number.isFinite(cfg.pollIntervalMs as number) ? Number(cfg.pollIntervalMs) : 3000;
  const timeoutMs = Number.isFinite(cfg.timeoutMs as number) ? Number(cfg.timeoutMs) : 10 * 60_000;
  const maxPoll = Number.isFinite(cfg.maxPoll as number) ? Number(cfg.maxPoll) : 240;
  const kind = (cfg.kind ?? "video") as VideoAsyncConfig["kind"];
  return {
    ...cfg,
    pollIntervalMs: Math.max(500, pollIntervalMs),
    timeoutMs: Math.max(5_000, timeoutMs),
    maxPoll: Math.max(1, maxPoll),
    kind,
    sourceLabel: (cfg.sourceLabel ?? "video-async").trim() || "video-async",
  };
}

export const videoAsyncTaskAgentRuntime: NodeTaskAgentRuntime<Input, Sensed, Executed, Committed> = {
  agentName: "视频异步任务 Agent",
  sense: ({ config }) => {
    if (!isTauri()) throw new Error("请在桌面端运行视频异步任务（浏览器预览环境不支持）");
    const cfg = normalizeConfig(config);
    if (!cfg.submit?.url?.trim()) throw new Error("videoAsync.submit.url 不能为空");
    if (!cfg.submit?.taskIdPointer?.trim()) throw new Error("videoAsync.submit.taskIdPointer 不能为空");
    if (!cfg.poll?.url?.trim()) throw new Error("videoAsync.poll.url 不能为空");
    if (!cfg.poll?.statusPointer?.trim()) throw new Error("videoAsync.poll.statusPointer 不能为空");
    return { config: cfg };
  },
  execute: async ({ config }, ctx) => {
    ctx.setStatusText("正在提交视频任务…");
    const submitReq = {
      url: config.submit.url,
      method: config.submit.method ?? "POST",
      headers: config.submit.headers ?? {},
      body: ensurePlainObject(config.submit.body),
      taskIdPointer: config.submit.taskIdPointer,
    };
    const submitRes = await invoke<{ taskId: string }>("generic_async_api_submit", { req: submitReq });
    const taskId = (submitRes.taskId ?? "").trim();
    if (!taskId) throw new Error("提交成功但未返回 taskId");

    ctx.setStatusText(`任务已提交：${taskId.slice(0, 8)}… 正在轮询…`);
    const startedAt = Date.now();
    let lastStatus = "";

    for (let i = 0; i < (config.maxPoll ?? 240); i++) {
      if (Date.now() - startedAt > (config.timeoutMs ?? 10 * 60_000)) {
        throw new Error("轮询超时");
      }
      const pollBody = interpolateBody(ensurePlainObject(config.poll.body), { taskId });
      const pollReq = {
        url: config.poll.url,
        method: config.poll.method ?? "POST",
        headers: config.poll.headers ?? {},
        body: pollBody,
        statusPointer: config.poll.statusPointer,
        doneValue: config.poll.doneValue,
        resultUrlPointer: config.poll.resultUrlPointer,
        errorPointer: config.poll.errorPointer,
      };
      const snap = await invoke<{ status: string; done: boolean; resultUrl?: string | null; error?: string | null }>(
        "generic_async_api_poll",
        { req: pollReq },
      );
      const st = (snap.status ?? "").trim();
      if (st && st !== lastStatus) {
        lastStatus = st;
        ctx.setStatusText(`视频任务状态：${st}`);
      }
      if (snap.done) {
        const err = (snap.error ?? "").trim();
        if (err) throw new Error(err);
        const resultUrl = (snap.resultUrl ?? "").trim();
        if (!resultUrl) throw new Error("任务已完成但未返回 resultUrl");

        ctx.setStatusText("任务完成，正在下载落盘…");
        const dl = await invoke<{ relPath: string; assetId?: string }>("download_remote_asset_to_project", {
          projectPath: ctx.projectPath,
          url: resultUrl,
          kind: config.kind ?? "video",
          sourceLabel: config.sourceLabel ?? "video-async",
        });
        const relPath = (dl.relPath ?? "").trim();
        if (!relPath) throw new Error("下载完成但未返回 relPath");
        return { relPath, assetId: dl.assetId, taskId };
      }
      await sleep(config.pollIntervalMs ?? 3000);
    }
    throw new Error("轮询次数达到上限");
  },
  validate: (executed) => executed,
  commit: ({ relPath, assetId }, ctx) => {
    ctx.updateNodeData(ctx.nodeId, { path: relPath, ...(assetId ? { assetId } : {}) });
    ctx.setStatusText("视频已下载并写入节点");
  },
};

