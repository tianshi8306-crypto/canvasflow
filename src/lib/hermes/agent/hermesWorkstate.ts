import { invoke, isTauri } from "@tauri-apps/api/core";
import type { HermesJob, HermesJobStatus } from "@/lib/hermes/agent/hermesJobStore";
import type { HermesCanvasEvent } from "@/lib/hermes/agent/hermesCanvasEvents";
import { formatCanvasReferentForPrompt } from "@/lib/hermes/agent/hermesCanvasReferent";
import { formatStyleAnchorForPrompt } from "@/lib/hermes/agent/hermesStyleReferent";
import { formatVersionStyleReferentForPrompt } from "@/lib/hermes/agent/hermesVersionReferent";
import { formatCanvasEventsForPrompt } from "@/lib/hermes/agent/hermesCanvasEvents";
import { formatLongContextForPrompt } from "@/lib/hermes/agent/hermesLongContext";

export const HERMES_WORKSTATE_REL_PATH = ".canvasflow/hermes/workstate.json";

export type HermesWorkstateJobSummary = {
  id: string;
  title: string;
  status: HermesJobStatus;
};

/** iter-101：多轮指代默认镜（选中/手改/工具） */
export type HermesCanvasReferent = {
  shotNumber: string;
  beatId?: string;
  nodeId?: string;
  source: "selection" | "canvas_edit" | "tool" | "plan";
  at: string;
};

export type HermesWorkstate = {
  version: 1;
  /** 用户最近一条制片目标（原文摘要） */
  currentGoal?: string;
  activeJobs: HermesWorkstateJobSummary[];
  lastCompletedTitle?: string;
  lastError?: string;
  /** iter-50：近期画布手改/选中事件 */
  recentCanvasEvents?: import("@/lib/hermes/agent/hermesCanvasEvents").HermesCanvasEvent[];
  /** iter-101：默认指代镜号 */
  lastCanvasReferent?: HermesCanvasReferent;
  /** iter-102：风格指代锚点 */
  lastStyleAnchor?: import("@/lib/hermes/agent/hermesStyleReferent").HermesStyleAnchor;
  /** iter-104：上一版脚本快照指代 */
  lastVersionStyleReferent?: import("@/lib/hermes/agent/hermesVersionReferent").HermesVersionStyleReferent;
  /** iter-53：当前 Job 内 Agent loop 轮次 */
  loopRound?: number;
  /** iter-53：最近一步 tool 结果摘要 */
  lastToolSummary?: string;
  /** iter-56 R4：工程梗概/镜头表/分镜要点摘要 */
  projectContextSummary?: string;
  /** iter-56 R4：较早 Hermes 对话摘要 */
  conversationDigest?: string;
  /** 已纳入 conversationDigest 的较早消息条数（各 Tab 合计） */
  digestedMessageCount?: number;
  /** iter-62：各 Tab 已 digest 到的消息条数（从该 Tab 历史头部计） */
  tabDigestedCounts?: Record<string, number>;
  /** iter-56：用户口头约束（记住/不要/必须） */
  userConstraints?: string[];
  updatedAt: string;
};

function emptyWorkstate(): HermesWorkstate {
  return {
    version: 1,
    activeJobs: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadHermesWorkstate(
  projectPath: string | null,
): Promise<HermesWorkstate> {
  if (!projectPath?.trim() || !isTauri()) return emptyWorkstate();
  try {
    const raw = await invoke<string>("read_project_rel_text_file", {
      projectPath: projectPath.trim(),
      relPath: HERMES_WORKSTATE_REL_PATH,
    });
    const parsed = JSON.parse(raw) as Partial<HermesWorkstate>;
    if (parsed.version !== 1) return emptyWorkstate();
    return {
      version: 1,
      currentGoal: parsed.currentGoal?.trim() || undefined,
      activeJobs: Array.isArray(parsed.activeJobs)
        ? parsed.activeJobs
            .filter((j) => j && typeof j.id === "string")
            .map((j) => ({
              id: String(j.id),
              title: String(j.title ?? "").trim() || "任务",
              status: normalizeJobStatus(j.status),
            }))
        : [],
      lastCompletedTitle: parsed.lastCompletedTitle?.trim() || undefined,
      lastError: parsed.lastError?.trim() || undefined,
      recentCanvasEvents: Array.isArray(parsed.recentCanvasEvents)
        ? (parsed.recentCanvasEvents as HermesCanvasEvent[]).filter(
            (e) => e && typeof e.message === "string",
          )
        : undefined,
      lastCanvasReferent: parseCanvasReferent(parsed.lastCanvasReferent),
      lastStyleAnchor: parseStyleAnchor(parsed.lastStyleAnchor),
      lastVersionStyleReferent: parseVersionStyleReferent(parsed.lastVersionStyleReferent),
      loopRound:
        typeof parsed.loopRound === "number" && parsed.loopRound >= 0
          ? Math.floor(parsed.loopRound)
          : undefined,
      lastToolSummary: parsed.lastToolSummary?.trim() || undefined,
      projectContextSummary: parsed.projectContextSummary?.trim() || undefined,
      conversationDigest: parsed.conversationDigest?.trim() || undefined,
      digestedMessageCount:
        typeof parsed.digestedMessageCount === "number" &&
        parsed.digestedMessageCount >= 0
          ? Math.floor(parsed.digestedMessageCount)
          : undefined,
      tabDigestedCounts:
        parsed.tabDigestedCounts && typeof parsed.tabDigestedCounts === "object"
          ? Object.fromEntries(
              Object.entries(parsed.tabDigestedCounts as Record<string, unknown>)
                .filter(([k, v]) => k.trim() && typeof v === "number" && v >= 0)
                .map(([k, v]) => [k, Math.floor(v as number)]),
            )
          : undefined,
      userConstraints: Array.isArray(parsed.userConstraints)
        ? parsed.userConstraints
            .map((c) => String(c).trim())
            .filter((c) => c.length >= 2)
            .slice(-8)
        : undefined,
      updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
    };
  } catch {
    return emptyWorkstate();
  }
}

function parseStyleAnchor(raw: unknown): HermesWorkstate["lastStyleAnchor"] {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const source = o.source;
  if (source !== "storyboard_edit" && source !== "bible" && source !== "image_ready" && source !== "video_ready") {
    return undefined;
  }
  const at = String(o.at ?? "").trim();
  if (!at) return undefined;
  return {
    shotNumber:
      typeof o.shotNumber === "string" ? o.shotNumber.trim() || undefined : undefined,
    beatId: typeof o.beatId === "string" ? o.beatId.trim() || undefined : undefined,
    visualPromptSnippet:
      typeof o.visualPromptSnippet === "string"
        ? o.visualPromptSnippet.trim() || undefined
        : undefined,
    bibleVisualStyle:
      typeof o.bibleVisualStyle === "string"
        ? o.bibleVisualStyle.trim() || undefined
        : undefined,
    videoMotionSnippet:
      typeof o.videoMotionSnippet === "string"
        ? o.videoMotionSnippet.trim() || undefined
        : undefined,
    source,
    at,
  };
}

function parseVersionStyleReferent(
  raw: unknown,
): HermesWorkstate["lastVersionStyleReferent"] {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const olderVersionId = String(o.olderVersionId ?? "").trim();
  const at = String(o.at ?? "").trim();
  if (!olderVersionId || !at) return undefined;
  const snapshots = Array.isArray(o.snapshots)
    ? (o.snapshots as unknown[])
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          const shotNumber = String(r.shotNumber ?? "").trim();
          if (!shotNumber) return null;
          return {
            shotNumber,
            visualPrompt:
              typeof r.visualPrompt === "string"
                ? r.visualPrompt.trim() || undefined
                : undefined,
            videoMotionPrompt:
              typeof r.videoMotionPrompt === "string"
                ? r.videoMotionPrompt.trim() || undefined
                : undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
    : [];
  if (snapshots.length === 0) return undefined;
  return { olderVersionId, snapshots, at };
}

function parseCanvasReferent(raw: unknown): HermesCanvasReferent | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const shotNumber = String(o.shotNumber ?? "").trim();
  if (!shotNumber) return undefined;
  const source = o.source;
  if (
    source !== "selection" &&
    source !== "canvas_edit" &&
    source !== "tool" &&
    source !== "plan"
  ) {
    return undefined;
  }
  return {
    shotNumber,
    beatId: typeof o.beatId === "string" ? o.beatId.trim() || undefined : undefined,
    nodeId: typeof o.nodeId === "string" ? o.nodeId.trim() || undefined : undefined,
    source,
    at: String(o.at ?? new Date().toISOString()),
  };
}

function normalizeJobStatus(status: unknown): HermesJobStatus {
  if (
    status === "queued" ||
    status === "running" ||
    status === "done" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "queued";
}

export async function saveHermesWorkstate(
  projectPath: string,
  workstate: HermesWorkstate,
): Promise<void> {
  if (!isTauri()) return;
  const payload: HermesWorkstate = {
    ...workstate,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await invoke("write_project_rel_text_file", {
    projectPath: projectPath.trim(),
    relPath: HERMES_WORKSTATE_REL_PATH,
    content: JSON.stringify(payload, null, 2),
  });
}

export function formatHermesWorkstateForPrompt(ws: HermesWorkstate): string {
  const lines: string[] = [];
  if (ws.currentGoal) {
    lines.push(`当前制片目标：${ws.currentGoal}`);
  }
  const active = ws.activeJobs.filter(
    (j) => j.status === "queued" || j.status === "running",
  );
  if (active.length > 0) {
    lines.push(
      "进行中的任务：",
      ...active.map((j) => `- [${j.status}] ${j.title}`),
    );
  }
  if (ws.lastError) {
    lines.push(`最近一次失败：${ws.lastError}`);
  }
  if (ws.lastCompletedTitle && active.length === 0) {
    lines.push(`最近完成：${ws.lastCompletedTitle}`);
  }
  const canvasBlock = formatCanvasEventsForPrompt(ws.recentCanvasEvents ?? []);
  if (canvasBlock) lines.push(canvasBlock);
  const referentHint = formatCanvasReferentForPrompt(ws.lastCanvasReferent);
  if (referentHint) lines.push(referentHint);
  const styleHint = formatStyleAnchorForPrompt(ws.lastStyleAnchor);
  if (styleHint) lines.push(styleHint);
  const versionHint = formatVersionStyleReferentForPrompt(ws.lastVersionStyleReferent);
  if (versionHint) lines.push(versionHint);
  if (typeof ws.loopRound === "number" && ws.loopRound > 0) {
    lines.push(`Agent loop 轮次：${ws.loopRound}`);
  }
  if (ws.lastToolSummary) {
    lines.push(`上一步结果：${ws.lastToolSummary}`);
  }
  const longCtx = formatLongContextForPrompt(ws);
  if (longCtx) lines.push(longCtx);
  return lines.join("\n");
}

export async function syncHermesWorkstateFromJobs(
  projectPath: string,
  jobs: HermesJob[],
  opts?: {
    currentGoal?: string;
    lastError?: string | null;
    lastCompletedTitle?: string;
    loopRound?: number | null;
    lastToolSummary?: string | null;
  },
): Promise<HermesWorkstate> {
  const prev = await loadHermesWorkstate(projectPath);
  const mine = jobs.filter((j) => j.projectPath === projectPath);
  const activeJobs: HermesWorkstateJobSummary[] = mine
    .filter((j) => j.status === "queued" || j.status === "running")
    .map((j) => ({ id: j.id, title: j.title, status: j.status }));

  const next: HermesWorkstate = {
    version: 1,
    currentGoal: opts?.currentGoal?.trim() || prev.currentGoal,
    activeJobs,
    lastCompletedTitle:
      opts?.lastCompletedTitle?.trim() || prev.lastCompletedTitle,
    lastError:
      opts?.lastError === null
        ? undefined
        : opts?.lastError !== undefined
          ? opts.lastError
          : prev.lastError,
    loopRound:
      opts?.loopRound === null
        ? undefined
        : opts?.loopRound !== undefined
          ? opts.loopRound
          : prev.loopRound,
    lastToolSummary:
      opts?.lastToolSummary === null
        ? undefined
        : opts?.lastToolSummary !== undefined
          ? opts.lastToolSummary
          : prev.lastToolSummary,
    projectContextSummary: prev.projectContextSummary,
    conversationDigest: prev.conversationDigest,
    digestedMessageCount: prev.digestedMessageCount,
    tabDigestedCounts: prev.tabDigestedCounts,
    userConstraints: prev.userConstraints,
    recentCanvasEvents: prev.recentCanvasEvents,
    lastCanvasReferent: prev.lastCanvasReferent,
    lastStyleAnchor: prev.lastStyleAnchor,
    lastVersionStyleReferent: prev.lastVersionStyleReferent,
    updatedAt: new Date().toISOString(),
  };

  await saveHermesWorkstate(projectPath, next);
  return next;
}

/** 内存缓存，供 Brain/Director 同步读取最近一次 workstate */
let cachedWorkstate: HermesWorkstate | null = null;

export function getCachedHermesWorkstate(): HermesWorkstate | null {
  return cachedWorkstate;
}

export function setCachedHermesWorkstateForTest(ws: HermesWorkstate | null): void {
  cachedWorkstate = ws;
}

export function patchCachedHermesWorkstate(
  patch: Partial<
    Pick<
      HermesWorkstate,
      "lastCanvasReferent" | "recentCanvasEvents" | "lastStyleAnchor" | "lastVersionStyleReferent"
    >
  >,
): void {
  if (!cachedWorkstate) return;
  cachedWorkstate = { ...cachedWorkstate, ...patch };
}

export async function refreshHermesWorkstateCache(
  projectPath: string | null,
): Promise<HermesWorkstate> {
  cachedWorkstate = await loadHermesWorkstate(projectPath);
  return cachedWorkstate;
}

export function formatCachedWorkstateForPrompt(): string {
  if (!cachedWorkstate) return "";
  return formatHermesWorkstateForPrompt(cachedWorkstate);
}
