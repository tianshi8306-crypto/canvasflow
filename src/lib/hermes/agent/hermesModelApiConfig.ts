import { isTauri } from "@tauri-apps/api/core";
import { getProviderMeta, type ProviderId } from "@/lib/providers";
import { providerSupportsCapability } from "@/lib/providerCapabilities";
import {
  createChatProviderConfig,
  listAddableChatProviderIds,
} from "@/lib/settingsModelDefaults";
import {
  loadKeyPreviews,
  maskApiKeyPreview,
} from "@/lib/settingsKeyPreview";
import {
  loadSettingsPanelData,
  normalizeLoadedSettings,
  saveSettingsAndKeys,
} from "@/lib/settingsPanelState";
import type { AppSettings, ImageModelConfig } from "@/lib/settingsPanelTypes";
import {
  newAudioModelTemplate,
  newImageModelTemplate,
  newVideoModelTemplate,
} from "@/lib/settingsModelTemplates";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { DOUBAO_SEEDANCE_API_MODEL } from "@/lib/videoGeneration/seedanceApiModel";

export type ModelApiLane = "chat" | "image" | "video" | "audio";

export type ParsedModelApiDraft = {
  lane: ModelApiLane;
  label?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  providerHint?: string;
};

export type ApplyModelApiConfigResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const CONFIG_VERB =
  /配置|设置|接入|绑定|填写|写入|帮我配|帮我设|添加.*模型|更新.*模型|改.*模型.*api/i;

const STATUS_VERB =
  /模型配置|模型状态|哪些模型|模型配好|api\s*配|密钥状态|key\s*状态/i;

function extractJsonBlock(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]!) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

export function extractApiKey(text: string): string | undefined {
  const json = extractJsonBlock(text);
  if (json) {
    const fromJson = pickString(json, [
      "apiKey",
      "api_key",
      "key",
      "token",
      "accessToken",
    ]);
    if (fromJson) return fromJson;
  }

  const labeled = text.match(
    /(?:api[_-]?key|密钥|key|token|access[_-]?token)[：:\s=]+([^\s，。；\n"'`]+)/i,
  );
  if (labeled?.[1]?.trim()) return labeled[1].trim().replace(/^['"]|['"]$/g, "");

  const sk = text.match(/\b(sk-[a-zA-Z0-9_-]{8,})\b/);
  if (sk?.[1]) return sk[1];

  const bearer = text.match(/Bearer\s+([^\s，。；\n]+)/i);
  if (bearer?.[1]) return bearer[1].trim();

  return undefined;
}

export function extractBaseUrl(text: string): string | undefined {
  const json = extractJsonBlock(text);
  if (json) {
    const fromJson = pickString(json, [
      "baseUrl",
      "base_url",
      "apiBaseUrl",
      "api_base_url",
      "url",
      "endpoint",
    ]);
    if (fromJson) return normalizeBaseUrl(fromJson);
  }

  const labeled = text.match(
    /(?:api(?:[_\s-]?地址|[_\s-]?base)?|base[_\s-]?url|接口地址|endpoint)[：:\s=]+([^\s，。；\n]+)/i,
  );
  if (labeled?.[1]?.trim()) return normalizeBaseUrl(labeled[1].trim());

  const raw = text.match(/https?:\/\/[^\s，。；\n"'`]+/i);
  if (raw?.[0]) return normalizeBaseUrl(raw[0]);
  return undefined;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/[，。；,.]+$/, "").replace(/\/+$/, "");
}

export function extractModelId(text: string): string | undefined {
  const json = extractJsonBlock(text);
  if (json) {
    const fromJson = pickString(json, [
      "model",
      "modelId",
      "model_id",
      "modelName",
      "model_name",
    ]);
    if (fromJson) return fromJson;
  }

  const labeled = text.match(
    /(?:模型标识|模型型号|model[_\s-]?id|model)[：:\s=]+([^\s，。；\n"'`]+)/i,
  );
  if (labeled?.[1]?.trim()) return labeled[1].trim().replace(/^['"]|['"]$/g, "");

  const doubao = text.match(/\b(doubao[-\w./]+|ep-\d+)/i);
  if (doubao?.[1]) return doubao[1];

  const dreamina = text.match(/\b(dreamina\/[\w.]+)\b/i);
  if (dreamina?.[1]) return dreamina[1];

  return undefined;
}

export function inferModelApiLane(text: string): ModelApiLane | null {
  const t = text.toLowerCase();
  if (/视频|seedance|图生视频|video/.test(t)) return "video";
  if (/图片|出图|seedream|image|文生图/.test(t)) return "image";
  if (/语音|tts|音频|audio|朗读/.test(t)) return "audio";
  if (/对话|文本|脚本|llm|gpt|聊天|灵体|openai/.test(t)) return "chat";

  const model = extractModelId(text)?.toLowerCase() ?? "";
  if (model.includes("seedance") || model.includes("video")) return "video";
  if (model.includes("seedream") || model.includes("image")) return "image";
  if (model.includes("tts")) return "audio";
  if (model.includes("gpt") || model.includes("claude")) return "chat";
  return null;
}

export function isModelApiConfigStatusIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/有什么区别|是什么|怎么用|教程|解释/.test(t) && !/配置/.test(t)) return false;
  return STATUS_VERB.test(t);
}

export function isModelApiConfigIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isModelApiConfigStatusIntent(t)) return false;
  if (/^(图片|视频|语音|对话|文本|脚本)(模型|api)[：:\s]/i.test(t)) return true;
  if (!CONFIG_VERB.test(t)) return false;
  return /模型|api|密钥|key|服务商|provider|seedream|seedance|openai|volc|方舟|即梦/i.test(t);
}

export function parseModelApiMaterials(text: string): ParsedModelApiDraft | null {
  const t = text.trim();
  if (!t) return null;

  const lane =
    inferModelApiLane(t) ??
    (/配置|设置|接入/.test(t) ? "chat" : null);
  if (!lane) return null;

  const apiKey = extractApiKey(t);
  const baseUrl = extractBaseUrl(t);
  const model = extractModelId(t);
  if (!apiKey && !baseUrl && !model) return null;

  const labelMatch = t.match(/(?:名称|叫|label)[：:\s]+([^\s，。；\n]{2,24})/i);
  const providerHint = /openai|grsai|ppio|apimart|volc|方舟|doubao|seedream|seedance|dreamina|即梦/i.exec(
    t,
  )?.[0];

  return {
    lane,
    label: labelMatch?.[1]?.trim(),
    baseUrl,
    apiKey,
    model,
    providerHint,
  };
}

function laneLabel(lane: ModelApiLane): string {
  switch (lane) {
    case "chat":
      return "对话/文本/脚本";
    case "image":
      return "图片";
    case "video":
      return "视频";
    case "audio":
      return "语音";
  }
}

function resolveChatProviderId(
  settings: AppSettings,
  draft: ParsedModelApiDraft,
): ProviderId | "openai-compatible-1" {
  const hint = (draft.providerHint ?? "").toLowerCase();
  const known: ProviderId[] = ["openai", "grsai", "ppio", "apimart", "aicanvas"];
  for (const id of known) {
    if (hint.includes(id)) return id;
  }
  if (/openai|gpt|兼容/.test(hint)) return "openai";
  const existingChat = settings.providers.find((p) =>
    providerSupportsCapability(p.id, "chat"),
  );
  if (existingChat) return existingChat.id as ProviderId;
  return "openai-compatible-1";
}

function upsertChatProvider(
  settings: AppSettings,
  draft: ParsedModelApiDraft,
): { settings: AppSettings; providerId: string; keys: Record<string, string> } {
  const keys: Record<string, string> = {};
  let providers = [...settings.providers];
  let targetId: ProviderId | "openai-compatible-1" = resolveChatProviderId(settings, draft);

  if (targetId === "openai-compatible-1") {
    let hit = providers.find((p) => p.id === "openai-compatible-1");
    if (!hit) {
      hit = {
        id: "openai-compatible-1",
        label: draft.label?.trim() || "OpenAI 兼容",
        baseUrl: draft.baseUrl || "https://api.openai.com/v1",
        model: draft.model || "gpt-4o-mini",
        priority: 0,
        enabled: true,
      };
      providers.push(hit);
    } else {
      hit = {
        ...hit,
        label: draft.label?.trim() || hit.label,
        baseUrl: draft.baseUrl || hit.baseUrl,
        model: draft.model || hit.model,
        enabled: true,
      };
      providers = providers.map((p) => (p.id === hit!.id ? hit! : p));
    }
    targetId = hit.id as ProviderId | "openai-compatible-1";
  } else {
    let hit = providers.find((p) => p.id === targetId);
    if (!hit) {
      const addable = listAddableChatProviderIds(providers);
      if (addable.includes(targetId)) {
        hit = createChatProviderConfig(targetId);
        providers.push(hit);
      } else {
        hit = createChatProviderConfig("openai");
        providers.push(hit);
        targetId = hit.id as ProviderId | "openai-compatible-1";
      }
    }
    hit = {
      ...hit,
      label: draft.label?.trim() || hit.label,
      baseUrl: draft.baseUrl || hit.baseUrl || getProviderMeta(targetId)?.defaultUrl || "",
      model: draft.model || hit.model,
      enabled: true,
    };
    providers = providers.map((p) => (p.id === hit!.id ? hit! : p));
    targetId = hit.id as ProviderId | "openai-compatible-1";
  }

  if (draft.apiKey) keys[targetId] = draft.apiKey;

  return {
    settings: {
      ...settings,
      providers,
      defaultProviderId: settings.defaultProviderId ?? targetId,
    },
    providerId: targetId,
    keys,
  };
}

function pickMediaModel(
  models: ImageModelConfig[],
  draft: ParsedModelApiDraft,
): ImageModelConfig | undefined {
  const modelNeedle = draft.model?.trim().toLowerCase();
  if (modelNeedle) {
    const byModel = models.find(
      (m) =>
        m.model.toLowerCase() === modelNeedle ||
        m.label.toLowerCase().includes(modelNeedle),
    );
    if (byModel) return byModel;
  }
  if (draft.label) {
    const byLabel = models.find((m) => m.label.includes(draft.label!));
    if (byLabel) return byLabel;
  }
  return models.find((m) => m.enabled) ?? models[0];
}

function buildMediaModel(
  lane: Exclude<ModelApiLane, "chat">,
  draft: ParsedModelApiDraft,
  existing?: ImageModelConfig,
): ImageModelConfig {
  const base =
    existing ??
    (lane === "image"
      ? newImageModelTemplate()
      : lane === "video"
        ? newVideoModelTemplate()
        : newAudioModelTemplate());

  const model =
    draft.model?.trim() ||
    base.model ||
    (lane === "video" ? DOUBAO_SEEDANCE_API_MODEL : lane === "audio" ? "tts-1" : "");

  const label =
    draft.label?.trim() ||
    base.label ||
    (lane === "image" ? "自定义图片模型" : lane === "video" ? "自定义视频模型" : "TTS 模型");

  return {
    ...base,
    label,
    model,
    apiBaseUrl: draft.baseUrl || base.apiBaseUrl || "",
    vendorName: base.vendorName || draft.providerHint || "",
    modelName: base.modelName || draft.providerHint || "",
    modelVariant: base.modelVariant || model,
    enabled: true,
  };
}

function upsertMediaLane(
  settings: AppSettings,
  lane: Exclude<ModelApiLane, "chat">,
  draft: ParsedModelApiDraft,
): {
  settings: AppSettings;
  modelId: string;
  keys: Record<string, string>;
  imageModelKeys?: Record<string, string>;
  videoModelKeys?: Record<string, string>;
  audioModelKeys?: Record<string, string>;
} {
  const listKey =
    lane === "image" ? "imageModels" : lane === "video" ? "videoModels" : "audioModels";
  const models = [...(settings[listKey] ?? [])];
  const existing = pickMediaModel(models, draft);
  const nextModel = buildMediaModel(lane, draft, existing);
  const idx = models.findIndex((m) => m.id === nextModel.id);
  if (idx >= 0) models[idx] = nextModel;
  else models.push(nextModel);

  const keys: Record<string, string> = {};
  const keyBag =
    lane === "image"
      ? { imageModelKeys: keys }
      : lane === "video"
        ? { videoModelKeys: keys }
        : { audioModelKeys: keys };
  if (draft.apiKey) keys[nextModel.id] = draft.apiKey;

  return {
    settings: { ...settings, [listKey]: models },
    modelId: nextModel.id,
    keys,
    ...keyBag,
  };
}

function missingFields(draft: ParsedModelApiDraft): string[] {
  const missing: string[] = [];
  if (draft.lane === "chat") {
    if (!draft.baseUrl && !draft.model) missing.push("API 地址或模型名");
  } else if (!draft.baseUrl && draft.lane !== "video") {
    if (!/dreamina|即梦|cli/i.test(draft.providerHint ?? "")) {
      missing.push("API 地址");
    }
  }
  if (!draft.apiKey) missing.push("API Key");
  if (draft.lane !== "chat" && !draft.model) missing.push("模型标识");
  return missing;
}

function formatApplyAck(
  lane: ModelApiLane,
  title: string,
  draft: ParsedModelApiDraft,
): string {
  const parts = [`已写入${laneLabel(lane)}模型「${title}」`];
  if (draft.baseUrl) parts.push(`地址 ${draft.baseUrl}`);
  if (draft.model) parts.push(`模型 ${draft.model}`);
  if (draft.apiKey) parts.push(`Key 已保存（${maskApiKeyPreview(draft.apiKey)}）`);
  parts.push("可在对应节点底栏选择；细节见 设置 → 模型。");
  return `${parts.join("；")}。`;
}

export async function applyModelApiConfig(
  draft: ParsedModelApiDraft,
): Promise<ApplyModelApiConfigResult> {
  return applyModelApiConfigDrafts([draft]);
}

export async function applyModelApiConfigDrafts(
  drafts: ParsedModelApiDraft[],
): Promise<ApplyModelApiConfigResult> {
  if (!isTauri()) return { ok: false, message: DESKTOP_SHELL_HINT };
  if (drafts.length === 0) {
    return { ok: false, message: "未解析到可导入的模型配置。" };
  }

  const valid: ParsedModelApiDraft[] = [];
  const skipped: string[] = [];
  for (const draft of drafts) {
    const missing = missingFields(draft);
    if (missing.length > 0) {
      skipped.push(`${laneLabel(draft.lane)}（缺 ${missing.join("、")}）`);
      continue;
    }
    valid.push(draft);
  }

  if (valid.length === 0) {
    return {
      ok: false,
      message: `配置不完整，无法导入：${skipped.join("；")}`,
    };
  }

  try {
    const loaded = await loadSettingsPanelData();
    let settings = loaded.settings;
    const keys: Record<string, string> = {};
    const imageModelKeys: Record<string, string> = {};
    const videoModelKeys: Record<string, string> = {};
    const audioModelKeys: Record<string, string> = {};
    const ackLines: string[] = [];

    for (const draft of valid) {
      if (draft.lane === "chat") {
        const chat = upsertChatProvider(settings, draft);
        settings = chat.settings;
        Object.assign(keys, chat.keys);
        const provider = settings.providers.find((p) => p.id === chat.providerId);
        ackLines.push(
          formatApplyAck(
            draft.lane,
            provider?.label || provider?.model || chat.providerId,
            draft,
          ),
        );
      } else {
        const media = upsertMediaLane(settings, draft.lane, draft);
        settings = media.settings;
        Object.assign(imageModelKeys, media.imageModelKeys ?? {});
        Object.assign(videoModelKeys, media.videoModelKeys ?? {});
        Object.assign(audioModelKeys, media.audioModelKeys ?? {});
        const list =
          draft.lane === "image"
            ? settings.imageModels
            : draft.lane === "video"
              ? settings.videoModels
              : settings.audioModels;
        const hit = list.find((m) => m.id === media.modelId);
        ackLines.push(
          formatApplyAck(
            draft.lane,
            hit?.label || hit?.model || media.modelId,
            draft,
          ),
        );
      }
    }

    await saveSettingsAndKeys({
      settings: normalizeLoadedSettings(settings),
      keys,
      imageModelKeys,
      videoModelKeys,
      audioModelKeys,
      keyPreviews: loadKeyPreviews(),
    });

    const summary =
      valid.length === 1
        ? ackLines[0]!
        : `已导入 ${valid.length} 项模型配置：\n${ackLines.map((l) => `· ${l}`).join("\n")}`;
    const skipNote =
      skipped.length > 0 ? `\n\n未导入：${skipped.join("；")}` : "";
    return { ok: true, message: `${summary}${skipNote}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `模型配置失败：${msg}` };
  }
}

export async function formatModelApiConfigStatus(): Promise<string> {
  if (!isTauri()) return DESKTOP_SHELL_HINT;

  const { settings, hasKey, hasImageModelKey, hasVideoModelKey, hasAudioModelKey } =
    await loadSettingsPanelData();

  const lines: string[] = ["当前节点模型配置："];

  const chatProviders = settings.providers.filter((p) =>
    providerSupportsCapability(p.id, "chat"),
  );
  if (chatProviders.length === 0) {
    lines.push("· 对话/脚本：未配置");
  } else {
    for (const p of chatProviders.slice(0, 3)) {
      lines.push(
        `· 对话/脚本：${p.label} · ${p.model} · Key ${hasKey[p.id] ? "已配置" : "未配置"}`,
      );
    }
  }

  const mediaLane = (
    label: string,
    models: ImageModelConfig[],
    hasMap: Record<string, boolean>,
  ) => {
    if (models.length === 0) {
      lines.push(`· ${label}：未配置`);
      return;
    }
    for (const m of models.filter((x) => x.enabled).slice(0, 2)) {
      lines.push(
        `· ${label}：${m.label || m.model} · Key ${hasMap[m.id] ? "已配置" : "未配置"}`,
      );
    }
  };

  mediaLane("图片", settings.imageModels, hasImageModelKey);
  mediaLane("视频", settings.videoModels ?? [], hasVideoModelKey);
  mediaLane("语音", settings.audioModels ?? [], hasAudioModelKey);

  lines.push(
    "",
    "可说「配置图片模型」并贴上 API 资料，或上传 `.env` / `.json` 配置文件导入。",
  );
  return lines.join("\n");
}

/** 供 Sidebar 统一入口：解析 + 应用或查状态 */
export async function messageForModelApiConfigChat(
  text: string,
): Promise<{ handled: boolean; message: string }> {
  if (isModelApiConfigStatusIntent(text)) {
    return { handled: true, message: await formatModelApiConfigStatus() };
  }
  if (!isModelApiConfigIntent(text)) {
    return { handled: false, message: "" };
  }
  const draft = parseModelApiMaterials(text);
  if (!draft) {
    return {
      handled: true,
      message:
        "请说明要配置哪类节点模型，并贴上资料，例如：\n配置图片模型\napi: https://ark.cn-beijing.volces.com/api/v3\nkey: sk-...\nmodel: Doubao-Seedream-5.0-lite",
    };
  }
  const result = await applyModelApiConfig(draft);
  return { handled: true, message: result.message };
}
