import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

const SKIPPED_VERSION_KEY = "canvasflow-updater-skipped-version";
const STARTUP_CHECK_KEY = "canvasflow-updater-startup-checked";

export type PendingAppUpdate = {
  version: string;
  notes: string;
  currentVersion: string;
  update: Update;
};

export function markUpdateSkipped(version: string): void {
  localStorage.setItem(SKIPPED_VERSION_KEY, version);
}

export function isUpdateSkipped(version: string): boolean {
  return localStorage.getItem(SKIPPED_VERSION_KEY) === version;
}

export function clearStartupUpdateCheckFlag(): void {
  sessionStorage.removeItem(STARTUP_CHECK_KEY);
}

function isLikelyOfflineError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("offline") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("connect") ||
    msg.includes("dns") ||
    msg.includes("resolve") ||
    msg.includes("internet") ||
    msg.includes("failed to fetch")
  );
}

/** 启动后仅检查一次；无网或已跳过版本时静默返回 null。 */
export async function checkForAppUpdateOnceAtStartup(): Promise<PendingAppUpdate | null> {
  if (!isTauri()) return null;
  if (sessionStorage.getItem(STARTUP_CHECK_KEY) === "1") return null;
  sessionStorage.setItem(STARTUP_CHECK_KEY, "1");

  try {
    const update = await check();
    if (!update) return null;
    if (isUpdateSkipped(update.version)) return null;

    const currentVersion = await getVersion();
    return {
      version: update.version,
      notes: update.body?.trim() ?? "",
      currentVersion,
      update,
    };
  } catch (err) {
    if (isLikelyOfflineError(err)) return null;
    console.debug("[appUpdater] check failed", err);
    return null;
  }
}

export async function downloadAndInstallAppUpdate(
  update: Update,
  onProgress?: (percent: number | null) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength: number | undefined;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      contentLength = event.data.contentLength ?? undefined;
      onProgress?.(contentLength ? 0 : null);
      return;
    }
    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      if (contentLength && contentLength > 0) {
        onProgress?.(Math.min(100, Math.round((downloaded / contentLength) * 100)));
      }
      return;
    }
    if (event.event === "Finished") {
      onProgress?.(100);
    }
  });

  await relaunch();
}
