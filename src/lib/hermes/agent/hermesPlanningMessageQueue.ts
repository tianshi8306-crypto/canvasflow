export type HermesPlanningQueuedMessage = {
  id: string;
  text: string;
  createdAt: number;
};

type Stored = {
  projectPath: string;
  items: HermesPlanningQueuedMessage[];
};

const STORAGE_PREFIX = "canvasflow.hermesPlanningQueue.v1";
export const HERMES_PLANNING_QUEUE_MAX = 3;

function storageKey(projectPath: string): string {
  return `${STORAGE_PREFIX}:${projectPath.trim()}`;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function loadPlanningMessageQueue(
  projectPath: string | null,
): HermesPlanningQueuedMessage[] {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(projectPath));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.projectPath !== projectPath.trim()) return [];
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (item) => item && typeof item.text === "string" && item.text.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function persistQueue(projectPath: string, items: HermesPlanningQueuedMessage[]): void {
  if (typeof sessionStorage === "undefined") return;
  const payload: Stored = { projectPath: projectPath.trim(), items };
  try {
    if (items.length === 0) {
      sessionStorage.removeItem(storageKey(projectPath));
    } else {
      sessionStorage.setItem(storageKey(projectPath), JSON.stringify(payload));
    }
  } catch {
    /* quota */
  }
}

export function enqueuePlanningProductionMessage(
  projectPath: string,
  text: string,
):
  | { ok: true; position: number; duplicate: false }
  | { ok: true; position: number; duplicate: true }
  | { ok: false; reason: string } {
  const norm = normalizeText(text);
  if (!norm) return { ok: false, reason: "指令为空，无法排队" };

  const queue = loadPlanningMessageQueue(projectPath);
  const dupIdx = queue.findIndex((item) => normalizeText(item.text) === norm);
  if (dupIdx >= 0) {
    return { ok: true, position: dupIdx + 1, duplicate: true };
  }
  if (queue.length >= HERMES_PLANNING_QUEUE_MAX) {
    return { ok: false, reason: `规划队列已满（最多 ${HERMES_PLANNING_QUEUE_MAX} 条）` };
  }

  const next: HermesPlanningQueuedMessage = {
    id: `pq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    createdAt: Date.now(),
  };
  const items = [...queue, next];
  persistQueue(projectPath, items);
  return { ok: true, position: items.length, duplicate: false };
}

export function dequeuePlanningProductionMessage(
  projectPath: string | null,
): HermesPlanningQueuedMessage | null {
  if (!projectPath?.trim()) return null;
  const queue = loadPlanningMessageQueue(projectPath);
  if (queue.length === 0) return null;
  const [head, ...rest] = queue;
  persistQueue(projectPath, rest);
  return head ?? null;
}

export function clearPlanningMessageQueue(projectPath: string | null): void {
  if (!projectPath?.trim() || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(projectPath));
  } catch {
    /* ignore */
  }
}

/** iter-114：按条件移除规划后队列项，返回移除数量 */
export function removePlanningQueueItems(
  projectPath: string | null,
  predicate: (item: HermesPlanningQueuedMessage) => boolean,
): number {
  if (!projectPath?.trim()) return 0;
  const queue = loadPlanningMessageQueue(projectPath);
  if (queue.length === 0) return 0;
  const kept = queue.filter((item) => !predicate(item));
  const removed = queue.length - kept.length;
  if (removed > 0) {
    persistQueue(projectPath, kept);
  }
  return removed;
}

export function formatPlanningQueueAck(text: string, position: number): string {
  const preview = text.trim().slice(0, 48);
  const suffix = text.trim().length > 48 ? "…" : "";
  return `已加入规划后队列（第 ${position} 位）：规划完成后将执行「${preview}${suffix}」。`;
}

export function hermesPlanningQueueStatusHint(
  queue: HermesPlanningQueuedMessage[],
): string | null {
  if (queue.length === 0) return null;
  const head = queue[0]!.text.trim();
  const preview = head.slice(0, 28);
  const ell = head.length > 28 ? "…" : "";
  if (queue.length === 1) {
    return `规划完成后将执行：${preview}${ell}`;
  }
  return `规划完成后将执行 ${queue.length} 条（${preview}${ell}）`;
}
