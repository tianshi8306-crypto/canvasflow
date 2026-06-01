/** 画布工程自动保存：编辑停顿后的防抖延迟（秒）；0 = 关闭 */
export type ProjectAutoSaveIdleSec = 0 | 0.5 | 2 | 5 | 30 | 60 | 300;

export const PROJECT_AUTO_SAVE_OPTIONS: {
  value: ProjectAutoSaveIdleSec;
  label: string;
  hint: string;
}[] = [
  { value: 0, label: "关闭", hint: "仅手动保存（Ctrl+S / 菜单）" },
  { value: 2, label: "停手 2 秒", hint: "默认；后台保存，不阻塞界面" },
  { value: 0.5, label: "停手约 0.5 秒", hint: "停顿很短即保存（大工程仍走后台线程）" },
  { value: 5, label: "停手 5 秒", hint: "连续操作时减少写入次数" },
  { value: 30, label: "停手 30 秒", hint: "适合大画布频繁微调" },
  { value: 60, label: "停手 1 分钟", hint: "停顿较久才保存" },
  { value: 300, label: "停手 5 分钟", hint: "最长间隔，务必记得手动保存重要节点" },
];

export const DEFAULT_PROJECT_AUTO_SAVE_IDLE_SEC: ProjectAutoSaveIdleSec = 2;

export function normalizeProjectAutoSaveIdleSec(raw: unknown): ProjectAutoSaveIdleSec {
  if (raw === undefined || raw === null) return DEFAULT_PROJECT_AUTO_SAVE_IDLE_SEC;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const hit = PROJECT_AUTO_SAVE_OPTIONS.find((o) => o.value > 0 && o.value === n);
  if (hit) return hit.value;
  if (n < 1) return 0.5;
  if (n < 3.5) return 2;
  if (n < 15) return 5;
  if (n < 45) return 30;
  if (n < 120) return 60;
  return 300;
}

export function projectAutoSaveDebounceMs(idleSec: ProjectAutoSaveIdleSec): number {
  if (idleSec <= 0) return 0;
  return Math.round(idleSec * 1000);
}

export function projectAutoSaveOptionLabel(idleSec: ProjectAutoSaveIdleSec): string {
  return PROJECT_AUTO_SAVE_OPTIONS.find((o) => o.value === idleSec)?.label ?? "停手 2 秒";
}
