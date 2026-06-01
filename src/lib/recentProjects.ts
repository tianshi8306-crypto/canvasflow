const STORAGE_KEY = "canvasflow-recent-projects";
const BROWSE_DIR_KEY = "canvasflow-last-browse-dir";
const MAX_RECENT = 10;

export function readRecentProjects(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  } catch {
    return [];
  }
}

export function pushRecentProject(path: string): void {
  const trimmed = path.trim();
  if (!trimmed) return;
  const prev = readRecentProjects().filter((p) => p !== trimmed);
  const next = [trimmed, ...prev].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

export function removeRecentProject(path: string): void {
  const trimmed = path.trim();
  if (!trimmed) return;
  const next = readRecentProjects().filter((p) => p !== trimmed);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** 工程文件夹的父目录（供系统对话框默认打开位置） */
export function projectParentDirectory(path: string): string | null {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!normalized) return null;
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}

export function readLastBrowseDirectory(): string | null {
  try {
    const raw = localStorage.getItem(BROWSE_DIR_KEY);
    return raw?.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

function writeLastBrowseDirectory(dir: string): void {
  const trimmed = dir.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(BROWSE_DIR_KEY, trimmed);
  } catch {
    // ignore
  }
}

/** 打开/新建成功后：更新最近列表与上次浏览目录 */
export function rememberProjectOpened(path: string): void {
  pushRecentProject(path);
  const parent = projectParentDirectory(path);
  if (parent) writeLastBrowseDirectory(parent);
}

/**
 * 系统「选择工程文件夹」对话框的默认起始目录：
 * 当前工程父目录 → 上次浏览目录 → 最近工程父目录
 */
export function readDefaultBrowseDirectory(currentProjectPath?: string | null): string | undefined {
  if (currentProjectPath?.trim()) {
    const parent = projectParentDirectory(currentProjectPath.trim());
    if (parent) return parent;
  }
  const lastBrowse = readLastBrowseDirectory();
  if (lastBrowse) return lastBrowse;
  const recent = readRecentProjects();
  if (recent[0]) {
    const parent = projectParentDirectory(recent[0]);
    if (parent) return parent;
  }
  return undefined;
}

export function getMostRecentProject(): string | null {
  return readRecentProjects()[0] ?? null;
}

export function projectFolderName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
