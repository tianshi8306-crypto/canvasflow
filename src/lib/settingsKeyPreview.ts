import type { AppSettings, KeyPreviewItem } from "./settingsPanelTypes";

export const KEY_PREVIEW_STORAGE = "canvasflow.api-key-previews.v1";

export function maskApiKeyPreview(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (t.length <= 8) return `${t.slice(0, 2)}***${t.slice(-2)}`;
  return `${t.slice(0, 4)}${"*".repeat(Math.max(6, t.length - 8))}${t.slice(-4)}`;
}

export function loadKeyPreviews(): Record<string, KeyPreviewItem> {
  try {
    const raw = localStorage.getItem(KEY_PREVIEW_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, KeyPreviewItem>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveKeyPreviews(data: Record<string, KeyPreviewItem>) {
  try {
    localStorage.setItem(KEY_PREVIEW_STORAGE, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

export function keyOwnerLabel(id: string, settings: AppSettings | null): string {
  if (!settings) return id;
  if (id.startsWith("image-model:")) {
    const mid = id.slice("image-model:".length);
    const hit = settings.imageModels.find((m) => m.id === mid);
    return `图片节点 · ${hit?.label || hit?.model || mid}`;
  }
  if (id.startsWith("video-model:")) {
    const mid = id.slice("video-model:".length);
    const hit = settings.videoModels?.find((m) => m.id === mid);
    return `视频节点 · ${hit?.label || hit?.model || mid}`;
  }
  if (id.startsWith("audio-model:")) {
    const mid = id.slice("audio-model:".length);
    const hit = settings.audioModels.find((m) => m.id === mid);
    return `音频节点 · ${hit?.label || hit?.model || mid}`;
  }
  const p = settings.providers.find((x) => x.id === id);
  return `文本/脚本节点 · ${p?.label || p?.model || id}`;
}
