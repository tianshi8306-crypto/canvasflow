import { invoke } from "@tauri-apps/api/core";
import { providerSupportsCapability } from "@/lib/providerCapabilities";
import { getDisplayModelName, getProviderMeta, type ProviderId } from "@/lib/providers";
import type { AppSettings, ProviderConfig } from "@/lib/settingsPanelTypes";

export type HermesLlmBinding = {
  providerId: string;
  model: string;
  label: string;
  /** 设置卡片上的显示名（可能与 meta.label 不同） */
  providerLabel: string;
  modelDisplay: string;
  dashboardUrl: string | null;
};

export type HermesLlmBindingStatus =
  | { kind: "ready"; binding: HermesLlmBinding }
  | { kind: "no_chat_provider" }
  | { kind: "missing_key"; binding: HermesLlmBinding };

function toBinding(row: ProviderConfig): HermesLlmBinding {
  const meta = getProviderMeta(row.id);
  const providerLabel = row.label?.trim() || meta?.label || row.id;
  const model = row.model?.trim() || "";
  return {
    providerId: row.id,
    model,
    label: providerLabel,
    providerLabel,
    modelDisplay: getDisplayModelName(model) || model || "未指定模型",
    dashboardUrl: meta?.getKeyUrl ?? null,
  };
}

export function listHermesChatProviderCandidates(settings: AppSettings): ProviderConfig[] {
  return settings.providers
    .filter((p) => p.enabled && providerSupportsCapability(p.id, "chat"))
    .sort((a, b) => a.priority - b.priority);
}

/** 解析 Hermes 将使用的对话服务商（与 Brain / Director LLM 一致） */
export async function resolveHermesLlmBinding(): Promise<HermesLlmBindingStatus> {
  const settings = await invoke<AppSettings>("load_settings");
  const candidates = listHermesChatProviderCandidates(settings);
  const first = candidates[0];
  if (!first) return { kind: "no_chat_provider" };

  const binding = toBinding(first);
  const hasKey = await invoke<boolean>("has_api_key", { providerId: first.id });
  if (!hasKey) return { kind: "missing_key", binding };
  return { kind: "ready", binding };
}

export async function pickHermesLlmProvider(): Promise<HermesLlmBinding | null> {
  const status = await resolveHermesLlmBinding();
  if (status.kind === "ready") return status.binding;
  return null;
}

export function quotaHintForProvider(providerId: string): string {
  const id = providerId as ProviderId;
  const meta = getProviderMeta(id);
  if (id === "aicanvas") return "本地模型，无云端余额";
  if (meta?.getKeyUrl) return "余额请在厂商控制台查看";
  return "余额未对接 API";
}
