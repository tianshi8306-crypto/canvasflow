import { invoke, isTauri } from "@tauri-apps/api/core";
import { loadEnabledProviderOptions, type TextNodeProviderOption } from "@/lib/textNodeProviders";

/** 从脚本节点 params 提取 LLM 调用覆盖（与 Rust openai_chat_completion extra_params 对齐） */
export function scriptNodeLlmInvokeParams(
  params: Record<string, unknown> | undefined,
): { providerId?: string; model?: string } {
  const raw = params && typeof params === "object" ? params : {};
  const providerId = String(raw.providerId ?? "").trim();
  const model = String(raw.model ?? "").trim();
  return {
    ...(providerId ? { providerId } : {}),
    ...(model ? { model } : {}),
  };
}

/** 解析 / 分镜前：节点所选 Provider，否则设置页启用列表中的第一项 */
export function resolveScriptProviderId(
  params: Record<string, unknown> | undefined,
  enabledProviders: TextNodeProviderOption[],
): string | null {
  const fromNode = String(params?.providerId ?? "").trim();
  if (fromNode && enabledProviders.some((p) => p.id === fromNode)) {
    return fromNode;
  }
  const sorted = [...enabledProviders].sort((a, b) => a.priority - b.priority);
  return sorted[0]?.id ?? null;
}

/** Tauri：解析 / 分镜前检查 Provider 与 API Key（浏览器预览跳过） */
export async function preflightScriptNodeLlm(
  params: Record<string, unknown> | undefined,
  setStatusText: (msg: string) => void,
): Promise<boolean> {
  if (!isTauri()) return true;
  const list = await loadEnabledProviderOptions();
  const providerId = resolveScriptProviderId(params, list);
  if (!providerId) {
    setStatusText("没有可用 Provider，请先到设置中启用一个模型通道");
    return false;
  }
  const label = list.find((p) => p.id === providerId)?.label ?? providerId;
  try {
    const hasKey = await invoke<boolean>("has_api_key", { providerId });
    if (!hasKey) {
      setStatusText(`未配置 API Key：${label}。请先到顶栏「设置」中填写`);
      return false;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatusText(`解析前检查失败：${msg}`);
    return false;
  }
  return true;
}
