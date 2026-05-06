import { isTauri } from "@tauri-apps/api/core";

export type VideoGenerationMode = "bridge" | "mock" | "auto";

const STORAGE_KEY = "videoGeneration.mode.v1";

function normalizeMode(raw: string | null | undefined): VideoGenerationMode | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "bridge" || v === "mock" || v === "auto") return v;
  return null;
}

export function resolveVideoGenerationMode(): VideoGenerationMode {
  const fromEnv = normalizeMode(import.meta.env.VITE_VIDEO_GENERATION_MODE);
  if (fromEnv) return fromEnv;
  try {
    const fromStorage = normalizeMode(window.localStorage.getItem(STORAGE_KEY));
    if (fromStorage) return fromStorage;
  } catch {
    // ignore storage unavailability
  }
  return isTauri() ? "bridge" : "mock";
}

export function persistVideoGenerationMode(mode: VideoGenerationMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}
