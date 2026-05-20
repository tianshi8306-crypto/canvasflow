/**
 * 即梦 (Dreamina) CLI 登录
 * 基于《即梦 CLI 体验指南》：通过本地 dreamina CLI 完成扫码/网页授权
 */

import { invoke } from "@tauri-apps/api/core";

/** 即梦 CLI 登录运行态 */
export interface DreaminaLoginRuntime {
  active: boolean;
  phase: string;
  message: string;
  error: string;
  startedAt: number;
  completedAt: number;
  exitCode: number | null;
  qrAvailable: boolean;
  qrVersion: number;
  qrUpdatedAt: number;
  verificationUrl: string;
  userCode: string;
  loginMode: string;
  loginPageUrl: string;
  authorizeUrl: string;
  callbackUrl: string;
  manualLoginAvailable: boolean;
  outputTail: string[];
}

/** 即梦 CLI 状态 */
export interface DreaminaCliStatus {
  installed: boolean;
  loginMode: string;
  loggedIn: boolean;
  credit: Record<string, unknown> | null;
  message: string;
  runtime: DreaminaLoginRuntime;
}

/** UI 展示用登录状态 */
export interface DreaminaAuthState {
  isLoggedIn: boolean;
  statusText: string;
  message: string;
  creditText: string;
  avatarUrl?: string;
  installed: boolean;
  runtime: DreaminaLoginRuntime | null;
}

export function formatDreaminaCredit(credit: Record<string, unknown> | null | undefined): string {
  if (!credit) return "登录后显示余额";
  if (credit.credit !== undefined) return `剩余额度：${String(credit.credit)}`;
  if (credit.balance !== undefined) return `余额：${String(credit.balance)}`;
  const nums = Object.values(credit).filter((v) => typeof v === "number");
  if (nums.length > 0) return `额度：${nums[0]}`;
  return "已登录";
}

function mapCliStatusToAuthState(status: DreaminaCliStatus): DreaminaAuthState {
  const runtime = status.runtime;
  const active = runtime?.active ?? false;
  const phase = runtime?.phase ?? "idle";

  let statusText = "未登录";
  if (active) {
    if (phase === "qr_ready") statusText = "等待扫码";
    else if (phase === "success" || phase === "reused") statusText = "登录成功";
    else if (phase === "failed") statusText = "登录失败";
    else statusText = "登录中";
  } else if (status.loggedIn) {
    statusText = "已登录";
  } else if (!status.installed) {
    statusText = "未安装 CLI";
  }

  return {
    isLoggedIn: status.loggedIn,
    statusText,
    message: runtime?.message || status.message,
    creditText: formatDreaminaCredit(status.credit),
    installed: status.installed,
    runtime,
  };
}

/** 检测即梦登录状态（调用 dreamina user_credit） */
export async function checkDreaminaAuthState(refresh = false): Promise<DreaminaAuthState> {
  try {
    const status = await invoke<DreaminaCliStatus>("dreamina_cli_status", { refresh });
    return mapCliStatusToAuthState(status);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "检测失败";
    return {
      isLoggedIn: false,
      statusText: "检测失败",
      message: msg,
      creditText: "登录后显示余额",
      installed: false,
      runtime: null,
    };
  }
}

/** 获取登录运行态 */
export async function fetchDreaminaLoginRuntime(): Promise<DreaminaLoginRuntime> {
  return invoke<DreaminaLoginRuntime>("dreamina_cli_login_runtime");
}

/** 发起扫码登录（headless） */
export async function startDreaminaQrLogin(force = false): Promise<DreaminaLoginRuntime> {
  return invoke<DreaminaLoginRuntime>("dreamina_cli_start_login", {
    mode: "headless",
    force,
  });
}

/** 发起网页登录 */
export async function startDreaminaWebLogin(force = false): Promise<DreaminaLoginRuntime> {
  return invoke<DreaminaLoginRuntime>("dreamina_cli_start_login", {
    mode: "web",
    force,
  });
}

/** 在系统浏览器打开授权链接 */
export async function openDreaminaAuthorizeUrl(): Promise<void> {
  await invoke("dreamina_cli_open_authorize_url");
}

/** 获取二维码 PNG（base64） */
export async function fetchDreaminaQrBase64(): Promise<string | null> {
  return invoke<string | null>("dreamina_cli_qr_base64");
}

/** 退出登录 */
export async function clearDreaminaToken(): Promise<DreaminaAuthState> {
  const status = await invoke<DreaminaCliStatus>("dreamina_cli_logout");
  return mapCliStatusToAuthState(status);
}

/** 登录是否已结束（成功/失败/复用） */
export function isDreaminaLoginTerminal(runtime: DreaminaLoginRuntime | null | undefined): boolean {
  if (!runtime) return false;
  if (runtime.active) return false;
  return ["success", "reused", "failed", "done"].includes(runtime.phase);
}

/** 登录是否成功 */
export function isDreaminaLoginSucceeded(runtime: DreaminaLoginRuntime | null | undefined): boolean {
  if (!runtime) return false;
  return runtime.phase === "success" || runtime.phase === "reused";
}
