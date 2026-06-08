import { invoke, isTauri } from "@tauri-apps/api/core";
import { formatUserError } from "@/lib/errors";
import { verifyApiKeyWithRetry } from "@/lib/settingsApiKeyVerify";
import { loadKeyPreviews, maskApiKeyPreview, saveKeyPreviews } from "@/lib/settingsKeyPreview";
import type {
  AppSettings,
  ImageModelConfig,
  KeyPreviewItem,
  ProviderConfig,
} from "@/lib/settingsPanelTypes";
import { ensureModelListDefaults } from "@/lib/settingsModelDefaults";
import { normalizeImageModelConfigOnLoad } from "@/lib/imageGeneration/normalizeImageModelConfig";
import { normalizeVideoModelConfigOnLoad } from "@/lib/videoGeneration/seedanceApiModel";
import { normalizeProjectAutoSaveIdleSec } from "@/lib/projectAutoSaveSettings";
import {
  agentSettingsFromAppSettings,
} from "@/lib/hermes/agent/hermesAgentSettings";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";

type HasKeyMaps = {
  hasKey: Record<string, boolean>;
  hasImageModelKey: Record<string, boolean>;
  hasAudioModelKey: Record<string, boolean>;
  hasVideoModelKey: Record<string, boolean>;
};

type SaveSettingsResult = HasKeyMaps & {
  settings: AppSettings;
  keyPreviews: Record<string, KeyPreviewItem>;
  notice: string;
};

export function normalizeLoadedSettings(s: AppSettings): AppSettings {
  const normalized: AppSettings = {
    ...s,
    abortWorkflowOnFailure: s.abortWorkflowOnFailure ?? false,
    hermesMemoryRoot: s.hermesMemoryRoot?.trim() ? s.hermesMemoryRoot.trim() : null,
    // 外观
    themePreset: s.themePreset ?? "dark",
    fontSize: s.fontSize ?? "medium",
    cursorStyle: s.cursorStyle ?? "default",
    gridDotsVisible: s.gridDotsVisible ?? true,
    promptActionSurface: s.promptActionSurface ?? "themed",
    // 节点行为
    showVideoMeta: s.showVideoMeta ?? true,
    imageVideoNodeResizeEnabled: s.imageVideoNodeResizeEnabled ?? true,
    promptBoxResizeEnabled: s.promptBoxResizeEnabled ?? true,
    titleFollowsCanvasZoom: s.titleFollowsCanvasZoom ?? true,
    nodeSpacing: s.nodeSpacing ?? 120,
    nodeDirection: s.nodeDirection ?? "right",
    nodeAvoidOverlap: s.nodeAvoidOverlap ?? true,
    // 画布对齐
    selectionRelatedHighlightEnabled: s.selectionRelatedHighlightEnabled ?? true,
    selectionRelatedHighlightColor: s.selectionRelatedHighlightColor ?? "white",
    snapGuidesEnabled: s.snapGuidesEnabled ?? true,
    connectionLinesVisible: s.connectionLinesVisible ?? true,
    snapGridEnabled: s.snapGridEnabled ?? false,
    alignFeatureTriggerMode: s.alignFeatureTriggerMode ?? "click",
    alignDistributeGap: s.alignDistributeGap ?? 40,
    // 素材
    uploadQuality: s.uploadQuality ?? "standard",
    projectAutoSaveIdleSec: normalizeProjectAutoSaveIdleSec(s.projectAutoSaveIdleSec),
    imageModels: (s.imageModels ?? []).map((m) =>
      normalizeImageModelConfigOnLoad({
        ...m,
        vendorName: m.vendorName ?? m.modelName ?? "",
        modelName: m.modelName ?? m.vendorName ?? "",
        modelVariant: m.modelVariant ?? m.model ?? "",
        apiBaseUrl: m.apiBaseUrl ?? "",
      }),
    ),
    videoModels: (s.videoModels ?? []).map((m) =>
      normalizeVideoModelConfigOnLoad({
        ...m,
        vendorName: m.vendorName ?? "",
        modelName: m.modelName ?? "",
        modelVariant: m.modelVariant ?? m.model ?? "",
        apiBaseUrl: m.apiBaseUrl ?? "",
      }),
    ),
    audioModels: (s.audioModels ?? []).map((m) => ({
      ...m,
      vendorName: m.vendorName ?? "",
      modelName: m.modelName ?? "",
      modelVariant: m.modelVariant ?? m.model ?? "",
      apiBaseUrl: m.apiBaseUrl ?? "",
    })),
  };
  return ensureModelListDefaults({
    ...normalized,
    ...agentSettingsFromAppSettings(s),
  });
}

export function mergeImportedSettings(prev: AppSettings, parsed: Partial<AppSettings>): AppSettings {
  const next = normalizeLoadedSettings({ ...prev, ...parsed });
  return {
    ...next,
    providers: Array.isArray(parsed.providers) ? (parsed.providers as ProviderConfig[]) : prev.providers,
    imageModels: Array.isArray(parsed.imageModels)
      ? (parsed.imageModels as ImageModelConfig[]).map((m) =>
          normalizeImageModelConfigOnLoad({
            ...m,
            vendorName: m.vendorName ?? m.modelName ?? "",
            modelName: m.modelName ?? m.vendorName ?? "",
            modelVariant: m.modelVariant ?? m.model ?? "",
            apiBaseUrl: m.apiBaseUrl ?? "",
          }),
        )
      : prev.imageModels,
    videoModels: Array.isArray(parsed.videoModels)
      ? (parsed.videoModels as ImageModelConfig[]).map((m) => ({
          ...m,
          vendorName: m.vendorName ?? "",
          modelName: m.modelName ?? "",
          modelVariant: m.modelVariant ?? m.model ?? "",
          apiBaseUrl: m.apiBaseUrl ?? "",
        }))
      : prev.videoModels ?? [],
    audioModels: Array.isArray(parsed.audioModels)
      ? (parsed.audioModels as ImageModelConfig[]).map((m) => ({
          ...m,
          vendorName: m.vendorName ?? "",
          modelName: m.modelName ?? "",
          modelVariant: m.modelVariant ?? m.model ?? "",
          apiBaseUrl: m.apiBaseUrl ?? "",
        }))
      : prev.audioModels ?? [],
  };
}

async function readHasKeyMaps(settings: AppSettings): Promise<HasKeyMaps> {
  const providerEntries = await Promise.all(
    settings.providers.map(async (p) => [p.id, await invoke<boolean>("has_api_key", { providerId: p.id })] as const),
  );
  const imageEntries = await Promise.all(
    settings.imageModels.map(
      async (m) =>
        [m.id, await invoke<boolean>("has_api_key", { providerId: `image-model:${m.id}` })] as const,
    ),
  );
  const videoEntries = await Promise.all(
    (settings.videoModels ?? []).map(
      async (m) =>
        [m.id, await invoke<boolean>("has_api_key", { providerId: `video-model:${m.id}` })] as const,
    ),
  );
  const audioEntries = await Promise.all(
    (settings.audioModels ?? []).map(
      async (m) =>
        [m.id, await invoke<boolean>("has_api_key", { providerId: `audio-model:${m.id}` })] as const,
    ),
  );
  return {
    hasKey: Object.fromEntries(providerEntries),
    hasImageModelKey: Object.fromEntries(imageEntries),
    hasVideoModelKey: Object.fromEntries(videoEntries),
    hasAudioModelKey: Object.fromEntries(audioEntries),
  };
}

export async function loadSettingsPanelData(): Promise<
  {
    settings: AppSettings;
    keyPreviews: Record<string, KeyPreviewItem>;
  } & HasKeyMaps
> {
  if (!isTauri()) throw new Error(DESKTOP_SHELL_HINT);
  const keyPreviews = loadKeyPreviews();
  const raw = await invoke<AppSettings>("load_settings");
  const settings = normalizeLoadedSettings(raw);
  const maps = await readHasKeyMaps(settings);
  return { settings, keyPreviews, ...maps };
}

export async function saveSettingsAndKeys(params: {
  settings: AppSettings;
  keys: Record<string, string>;
  imageModelKeys?: Record<string, string>;
  audioModelKeys?: Record<string, string>;
  videoModelKeys?: Record<string, string>;
  keyPreviews: Record<string, KeyPreviewItem>;
}): Promise<SaveSettingsResult> {
  const { settings, keys, imageModelKeys = {}, audioModelKeys = {}, videoModelKeys = {}, keyPreviews } = params;
  if (!isTauri()) throw new Error(DESKTOP_SHELL_HINT);

  await invoke("save_settings", { settings });
  const mustExistIds: string[] = [];

  for (const p of settings.providers) {
    const v = keys[p.id]?.trim();
    if (!v) continue;
    await invoke("save_api_key", { providerId: p.id, apiKey: v });
    mustExistIds.push(p.id);
  }
  for (const m of settings.imageModels) {
    const v = imageModelKeys[m.id]?.trim();
    if (!v) continue;
    const pid = `image-model:${m.id}`;
    await invoke("save_api_key", { providerId: pid, apiKey: v });
    mustExistIds.push(pid);
  }
  for (const m of settings.audioModels ?? []) {
    const v = audioModelKeys[m.id]?.trim();
    if (!v) continue;
    const pid = `audio-model:${m.id}`;
    await invoke("save_api_key", { providerId: pid, apiKey: v });
    mustExistIds.push(pid);
  }
  for (const m of settings.videoModels ?? []) {
    const v = videoModelKeys[m.id]?.trim();
    if (!v) continue;
    const pid = `video-model:${m.id}`;
    await invoke("save_api_key", { providerId: pid, apiKey: v });
    mustExistIds.push(pid);
  }

  const failed: string[] = [];
  for (const pid of mustExistIds) {
    const ok = await verifyApiKeyWithRetry(pid);
    if (!ok) failed.push(pid);
  }
  if (failed.length > 0) {
    throw new Error(
      `以下密钥写入失败，请重试：\n${failed.join("\n")}\n\n如果反复失败，请重启应用后再试；仍失败请反馈系统版本与截图。`,
    );
  }

  const nextPreview = { ...keyPreviews };
  const today = new Date().toISOString().slice(0, 10);
  for (const p of settings.providers) {
    const v = keys[p.id]?.trim();
    if (v) nextPreview[p.id] = { masked: maskApiKeyPreview(v), savedAt: today };
  }
  for (const m of settings.imageModels) {
    const v = imageModelKeys[m.id]?.trim();
    if (v) nextPreview[`image-model:${m.id}`] = { masked: maskApiKeyPreview(v), savedAt: today };
  }
  for (const m of settings.audioModels ?? []) {
    const v = audioModelKeys[m.id]?.trim();
    if (v) nextPreview[`audio-model:${m.id}`] = { masked: maskApiKeyPreview(v), savedAt: today };
  }
  for (const m of settings.videoModels ?? []) {
    const v = videoModelKeys[m.id]?.trim();
    if (v) nextPreview[`video-model:${m.id}`] = { masked: maskApiKeyPreview(v), savedAt: today };
  }
  saveKeyPreviews(nextPreview);

  const maps = await readHasKeyMaps(settings);
  return {
    ...maps,
    settings,
    keyPreviews: nextPreview,
    notice: "保存成功：设置与 API Key 已写入。出于安全考虑，输入框不会回显。",
  };
}

export function toUserMessage(prefix: string, error: unknown): string {
  return `${prefix}：${formatUserError(error)}`;
}
