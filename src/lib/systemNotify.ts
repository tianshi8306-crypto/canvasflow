/**
 * systemNotify.ts
 *
 * 系统原生通知工具。视频/图片生成完成后弹出桌面通知，
 * 用户即使最小化窗口也能感知任务状态变化。
 *
 * - Tauri 环境：调用 @tauri-apps/plugin-notification 原生 API
 * - 浏览器开发环境：回退到 Web Notification API
 */

import { isTauri } from "@tauri-apps/api/core";

let permissionCached: boolean | null = null;

/** 确保通知权限已授予（首次调用时弹窗请求，后续缓存） */
async function ensurePermission(): Promise<boolean> {
  if (permissionCached !== null) return permissionCached;

  if (isTauri()) {
    try {
      // 动态 import，避免非 Tauri 环境（如测试）报错
      const mod = await import("@tauri-apps/plugin-notification");
      let granted = await mod.isPermissionGranted();
      if (!granted) {
        const perm = await mod.requestPermission();
        granted = perm === "granted";
      }
      permissionCached = granted;
      return granted;
    } catch {
      permissionCached = false;
      return false;
    }
  }

  // Web fallback
  if (!("Notification" in window)) {
    permissionCached = false;
    return false;
  }
  if (Notification.permission === "granted") {
    permissionCached = true;
    return true;
  }
  if (Notification.permission === "denied") {
    permissionCached = false;
    return false;
  }
  const result = await Notification.requestPermission();
  permissionCached = result === "granted";
  return permissionCached;
}

/** 发送原生系统通知 */
async function sendNative(title: string, body: string): Promise<void> {
  if (!(await ensurePermission())) return;

  if (isTauri()) {
    try {
      const mod = await import("@tauri-apps/plugin-notification");
      mod.sendNotification({ title, body });
    } catch {
      // 静默失败，通知是锦上添花
    }
    return;
  }

  // Web fallback
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: undefined });
  }
}

/**
 * 生成任务成功完成时的通知
 */
export async function notifyTaskSuccess(
  agentLabel: string,
  detail?: string,
): Promise<void> {
  const body = detail
    ? `${agentLabel}任务已成功完成：${detail}`
    : `${agentLabel}任务已成功完成`;
  await sendNative("任务完成", body);
}

/**
 * 生成任务失败时的通知
 */
export async function notifyTaskFailure(
  agentLabel: string,
  error?: string,
): Promise<void> {
  const body = error
    ? `${agentLabel}任务失败：${error}`
    : `${agentLabel}任务执行失败，请检查后重试`;
  await sendNative("任务失败", body);
}
