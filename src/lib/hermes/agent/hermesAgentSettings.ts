import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import { getHermesToolRegistryEntry, isRegistryToolAllowed } from "@/lib/hermes/mcp/hermesToolRegistry";
export type HermesAgentSettings = {
  agentAutoExecute: boolean;
  agentAutoBatch: boolean;
  agentAllowScriptEdit: boolean;
  agentAllowMediaSubmit: boolean;
  agentMaxConcurrentMedia: number;
  /** iter-53：步内 observe → 插入依赖 / 失败 recovery */
  agentLoopEnabled: boolean;
  /** iter-61：长上下文摘要用 LLM（关则仅规则压缩） */
  agentLongContextLlmSummary: boolean;
  /** iter-73：任务结束后 LLM 复盘写入记忆 */
  agentPostJobLlmReflect: boolean;
  /** 灵体：失败/断链/续跑建议自动提交 Director（需同时开启自动执行） */
  agentProactiveRecovery: boolean;
};

export const HERMES_AGENT_SETTINGS_UPDATED = "canvasflow-hermes-agent-settings-updated";

let cached: HermesAgentSettings | null = null;

/** 单测注入 */
export function setHermesAgentSettingsCacheForTest(
  settings: HermesAgentSettings | null,
): void {
  cached = settings;
}

export function defaultHermesAgentSettings(): HermesAgentSettings {
  return {
    agentAutoExecute: true,
    agentAutoBatch: true,
    agentAllowScriptEdit: true,
    agentAllowMediaSubmit: true,
    agentMaxConcurrentMedia: 2,
    agentLoopEnabled: true,
    agentLongContextLlmSummary: true,
    agentPostJobLlmReflect: true,
    agentProactiveRecovery: false,
  };
}

export function agentSettingsFromAppSettings(
  s: Partial<AppSettings> | null | undefined,
): HermesAgentSettings {
  const d = defaultHermesAgentSettings();
  if (!s) return d;
  return {
    agentAutoExecute: s.agentAutoExecute ?? d.agentAutoExecute,
    agentAutoBatch: s.agentAutoBatch ?? d.agentAutoBatch,
    agentAllowScriptEdit: s.agentAllowScriptEdit ?? d.agentAllowScriptEdit,
    agentAllowMediaSubmit: s.agentAllowMediaSubmit ?? d.agentAllowMediaSubmit,
    agentMaxConcurrentMedia: clampConcurrent(
      s.agentMaxConcurrentMedia ?? d.agentMaxConcurrentMedia,
    ),
    agentLoopEnabled: s.agentLoopEnabled ?? d.agentLoopEnabled,
    agentLongContextLlmSummary:
      s.agentLongContextLlmSummary ?? d.agentLongContextLlmSummary,
    agentPostJobLlmReflect:
      s.agentPostJobLlmReflect ?? d.agentPostJobLlmReflect,
    agentProactiveRecovery:
      s.agentProactiveRecovery ?? d.agentProactiveRecovery,
  };
}

function clampConcurrent(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.min(3, Math.max(1, Math.round(n)));
}

export function loadHermesAgentSettingsSync(): HermesAgentSettings {
  return cached ?? defaultHermesAgentSettings();
}

export async function refreshHermesAgentSettings(): Promise<HermesAgentSettings> {
  if (!isTauri()) {
    cached = defaultHermesAgentSettings();
    return cached;
  }
  try {
    const raw = await invoke<AppSettings>("load_settings");
    cached = agentSettingsFromAppSettings(raw);
  } catch {
    cached = defaultHermesAgentSettings();
  }
  return cached;
}

export async function patchHermesAgentSettings(
  patch: Partial<HermesAgentSettings>,
): Promise<HermesAgentSettings> {
  if (!isTauri()) {
    cached = { ...loadHermesAgentSettingsSync(), ...patch };
    return cached;
  }
  const raw = await invoke<AppSettings>("load_settings");
  const next = agentSettingsFromAppSettings({ ...raw, ...patch });
  await invoke("save_settings", {
    settings: {
      ...raw,
      ...next,
    },
  });
  cached = next;
  window.dispatchEvent(new CustomEvent(HERMES_AGENT_SETTINGS_UPDATED));
  window.dispatchEvent(new CustomEvent("canvasflow-settings-saved"));
  return next;
}

export function shouldAutoExecutePlans(settings = loadHermesAgentSettingsSync()): boolean {
  return settings.agentAutoExecute;
}

export function shouldProactiveRecoveryAutoAct(
  settings = loadHermesAgentSettingsSync(),
): boolean {
  return settings.agentProactiveRecovery && settings.agentAutoExecute;
}

export function shouldUseAgentLoop(settings = loadHermesAgentSettingsSync()): boolean {
  return settings.agentLoopEnabled;
}

export function shouldUseLongContextLlmSummary(
  settings = loadHermesAgentSettingsSync(),
): boolean {
  return settings.agentLongContextLlmSummary;
}

export function shouldUsePostJobLlmReflect(
  settings = loadHermesAgentSettingsSync(),
): boolean {
  return settings.agentPostJobLlmReflect;
}

export function shouldSkipBatchConfirm(settings = loadHermesAgentSettingsSync()): boolean {
  return settings.agentAutoBatch;
}

export function getAgentMaxConcurrentMedia(
  settings = loadHermesAgentSettingsSync(),
): number {
  return clampConcurrent(settings.agentMaxConcurrentMedia);
}

export function isPlanStepAllowed(
  step: HermesPlanStep,
  settings = loadHermesAgentSettingsSync(),
): { allowed: boolean; reason?: string } {
  const entry = getHermesToolRegistryEntry(step.toolId);
  if (entry) return isRegistryToolAllowed(entry, settings);
  return { allowed: true };
}

export function formatAwaitExecutePrompt(): string {
  return "回复 **执行** 或 **确认** 开始；回复 **取消** 则不做。";
}

export const AGENT_RISK_BULLETS = [
  "自动修改可能覆盖已有分镜与提示词。",
  "批量出图/出视频将消耗 API 额度，费用以服务商账单为准。",
  "生成失败或质量不佳需在画布上调整；Agent 不保证可发行成片。",
  "建议在重要节点保存工程。",
] as const;
