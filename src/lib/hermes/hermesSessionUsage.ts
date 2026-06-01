const STORAGE_KEY = "canvasflow.hermesSessionUsage.v1";
export const HERMES_USAGE_UPDATED_EVENT = "canvasflow-hermes-usage-updated";

type Row = {
  projectPath: string;
  estimatedTokens: number;
  updatedAt: number;
};

function readAll(): Row[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Row[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: Row[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-20)));
  } catch {
    /* quota */
  }
}

export function estimateTokensFromText(text: string): number {
  const len = text.trim().length;
  if (len === 0) return 0;
  return Math.max(1, Math.ceil(len / 3));
}

export function addHermesSessionTokens(
  projectPath: string | null,
  deltaTokens: number,
): void {
  if (!projectPath?.trim() || deltaTokens <= 0) return;
  const rows = readAll();
  const idx = rows.findIndex((r) => r.projectPath === projectPath);
  const next: Row = {
    projectPath,
    estimatedTokens:
      (idx >= 0 ? rows[idx]!.estimatedTokens : 0) + Math.round(deltaTokens),
    updatedAt: Date.now(),
  };
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  writeAll(rows);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HERMES_USAGE_UPDATED_EVENT));
  }
}

export function getHermesSessionTokens(projectPath: string | null): number {
  if (!projectPath?.trim()) return 0;
  return readAll().find((r) => r.projectPath === projectPath)?.estimatedTokens ?? 0;
}

export function formatTokenEstimate(n: number): string {
  if (n <= 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
