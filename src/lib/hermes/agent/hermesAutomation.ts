import { invoke, isTauri } from "@tauri-apps/api/core";

export const HERMES_AUTOMATIONS_REL_PATH = ".canvasflow/hermes/automations.json";

export type HermesScheduledJob = {
  id: string;
  title: string;
  /** 到期后自动发给 Hermes 的制片指令 */
  prompt: string;
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  createdAt: string;
};

export type HermesAutomationStore = {
  version: 1;
  jobs: HermesScheduledJob[];
};

function emptyStore(): HermesAutomationStore {
  return { version: 1, jobs: [] };
}

export async function loadHermesAutomations(
  projectPath: string | null,
): Promise<HermesAutomationStore> {
  if (!projectPath?.trim() || !isTauri()) return emptyStore();
  try {
    const raw = await invoke<string>("read_project_rel_text_file", {
      projectPath: projectPath.trim(),
      relPath: HERMES_AUTOMATIONS_REL_PATH,
    });
    const parsed = JSON.parse(raw) as Partial<HermesAutomationStore>;
    if (!Array.isArray(parsed.jobs)) return emptyStore();
    return {
      version: 1,
      jobs: parsed.jobs.filter((j) => j && j.prompt?.trim()),
    };
  } catch {
    return emptyStore();
  }
}

export async function saveHermesAutomations(
  projectPath: string,
  store: HermesAutomationStore,
): Promise<void> {
  if (!isTauri()) return;
  await invoke("write_project_rel_text_file", {
    projectPath: projectPath.trim(),
    relPath: HERMES_AUTOMATIONS_REL_PATH,
    content: JSON.stringify({ version: 1, jobs: store.jobs }, null, 2),
  });
}

export async function upsertHermesAutomation(
  projectPath: string,
  job: Omit<HermesScheduledJob, "id" | "createdAt" | "lastRunAt"> & {
    id?: string;
  },
): Promise<HermesScheduledJob> {
  const store = await loadHermesAutomations(projectPath);
  const created: HermesScheduledJob = {
    id: job.id?.trim() || crypto.randomUUID(),
    title: job.title.trim() || "定时制片",
    prompt: job.prompt.trim(),
    enabled: job.enabled,
    intervalMinutes: Math.max(5, job.intervalMinutes),
    lastRunAt: null,
    createdAt: new Date().toISOString(),
  };
  const idx = store.jobs.findIndex((j) => j.id === created.id);
  if (idx >= 0) {
    store.jobs[idx] = { ...store.jobs[idx]!, ...created, createdAt: store.jobs[idx]!.createdAt };
  } else {
    store.jobs.push(created);
  }
  await saveHermesAutomations(projectPath, store);
  return created;
}

export function parseAutomationFromMessage(message: string): {
  intervalMinutes: number;
  prompt: string;
  title: string;
} | null {
  const t = message.trim();
  const every = t.match(/每\s*(\d+)\s*分钟/);
  const hourly = /每小时/.test(t);
  const intervalMinutes = every
    ? parseInt(every[1]!, 10)
    : hourly
      ? 60
      : null;
  if (!intervalMinutes || intervalMinutes < 5) return null;
  const prompt = t
    .replace(/每\s*\d+\s*分钟|每小时|定时|自动|执行|跑/g, "")
    .replace(/^[：:\s]+/, "")
    .trim();
  if (prompt.length < 4) return null;
  return {
    intervalMinutes,
    title: `每 ${intervalMinutes} 分钟`,
    prompt,
  };
}

export function dueHermesJobs(
  store: HermesAutomationStore,
  now = Date.now(),
): HermesScheduledJob[] {
  return store.jobs.filter((j) => {
    if (!j.enabled) return false;
    if (!j.lastRunAt) return true;
    const last = Date.parse(j.lastRunAt);
    if (Number.isNaN(last)) return true;
    return now - last >= j.intervalMinutes * 60_000;
  });
}

export async function markHermesJobRan(
  projectPath: string,
  jobId: string,
): Promise<void> {
  const store = await loadHermesAutomations(projectPath);
  const job = store.jobs.find((j) => j.id === jobId);
  if (!job) return;
  job.lastRunAt = new Date().toISOString();
  await saveHermesAutomations(projectPath, store);
}

export function formatAutomationsForUser(store: HermesAutomationStore): string {
  if (store.jobs.length === 0) {
    return "当前工程无定时任务。可说「每 30 分钟检查流程并汇报」创建自动化。";
  }
  return store.jobs
    .map(
      (j) =>
        `· ${j.title}（${j.enabled ? "开" : "关"}，${j.intervalMinutes} 分钟）→ ${j.prompt}`,
    )
    .join("\n");
}
