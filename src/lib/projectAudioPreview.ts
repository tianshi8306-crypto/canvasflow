import { invoke, isTauri } from "@tauri-apps/api/core";
import { joinProjectRelativePath } from "@/lib/paths";
import { getMime, readFileAsDataUrl } from "@/lib/mediaUtils";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";

/** 走 asset / Blob 播放更稳的格式（WebView2 对 data:audio/mpeg 支持差） */
export const AUDIO_ASSET_PLAYBACK_EXTS = new Set(["mp3", "aac", "m4a"]);

export function audioExtFromRelPath(relPath: string): string {
  const norm = relPath.replace(/\\/g, "/");
  const dot = norm.lastIndexOf(".");
  if (dot < 0) return "";
  return norm.slice(dot + 1).toLowerCase();
}

export function prefersAssetPlayback(relPath: string): boolean {
  return AUDIO_ASSET_PLAYBACK_EXTS.has(audioExtFromRelPath(relPath));
}

/** Tauri：读工程内音频为 ArrayBuffer（供 decodeAudioData / Blob URL） */
export async function readProjectAudioBytes(
  projectPath: string,
  relPath: string,
): Promise<ArrayBuffer> {
  const abs = joinProjectRelativePath(projectPath.trim(), relPath.trim());
  const base64: string = await invoke("read_file_as_base64", { path: abs });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 解析音频预览播放 URL。
 * - mp3/aac/m4a：优先 asset 协议，其次 Blob URL
 * - wav/ogg/flac：data URL
 */
export async function resolveProjectAudioPlaybackSrc(
  projectPath: string,
  relPath: string,
): Promise<string | null> {
  const root = projectPath.trim();
  const rel = relPath.trim();
  if (!root || !rel) return null;

  if (!isTauri()) {
    return resolveProjectAssetSrc(root, rel);
  }

  const abs = joinProjectRelativePath(root, rel);
  const ext = audioExtFromRelPath(rel);

  if (prefersAssetPlayback(rel)) {
    const asset = resolveProjectAssetSrc(root, rel);
    if (asset) return asset;
    try {
      const buf = await readProjectAudioBytes(root, rel);
      const mime = getMime(ext);
      return URL.createObjectURL(new Blob([buf], { type: mime }));
    } catch {
      /* fall through */
    }
  }

  try {
    return await readFileAsDataUrl(abs);
  } catch {
    const asset = resolveProjectAssetSrc(root, rel);
    if (asset) return asset;
    try {
      const buf = await readProjectAudioBytes(root, rel);
      return URL.createObjectURL(new Blob([buf], { type: getMime(ext) }));
    } catch {
      return null;
    }
  }
}
