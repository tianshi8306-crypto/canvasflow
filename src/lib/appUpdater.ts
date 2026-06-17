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
    msg.includes("failed to fetch") ||
    msg.includes("error sending request for url")
  );
}

/** 带友好提示的网络错误，用于手动更新检查时向用户展示。 */
export class AppUpdaterNetworkError extends Error {
  constructor(cause?: unknown) {
    super(
      "无法连接到更新服务器。请检查网络连接，或开启 VPN/系统代理后重试。"
    );
    this.name = "AppUpdaterNetworkError";
    this.cause = cause;
  }
}

/** 启动后仅检查一次；无网或已跳过版本时静默返回 null。 */
export async function checkForAppUpdateOnceAtStartup(): Promise<PendingAppUpdate | null> {
  if (!isTauri()) return null;
  if (sessionStorage.getItem(STARTUP_CHECK_KEY) === "1") return null;
  sessionStorage.setItem(STARTUP_CHECK_KEY, "1");
  try {
    return await checkForAppUpdateManual({ respectSkipped: true });
  } catch (err) {
    if (isLikelyOfflineError(err)) {
      console.warn("[appUpdater] 网络不可用，跳过更新检查", err);
      return null;
    }
    console.error("[appUpdater] 启动更新检查失败", err);
    return null;
  }
}

/** 设置页手动检查更新；默认不跳过已忽略版本。
 *  网络错误时抛出 AppUpdaterNetworkError，以便 UI 展示友好提示。 */
export async function checkForAppUpdateManual(opts?: {
  respectSkipped?: boolean;
}): Promise<PendingAppUpdate | null> {
  if (!isTauri()) return null;
  try {
    const update = await check();
    if (!update) return null;
    if (opts?.respectSkipped && isUpdateSkipped(update.version)) return null;
    const currentVersion = await getVersion();
    return {
      version: update.version,
      notes: update.body?.trim() ?? "",
      currentVersion,
      update,
    };
  } catch (err) {
    if (isLikelyOfflineError(err)) {
      throw new AppUpdaterNetworkError(err);
    }
    throw err instanceof Error ? err : new Error(String(err));
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
