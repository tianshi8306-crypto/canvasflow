import { invoke } from "@tauri-apps/api/core";

/** 文件 MIME 类型映射 */
const MIME_MAP: Record<string, string> = {
  // 图片
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  // 视频
  mp4: "video/mp4",
  mov: "video/quicktime",
  // 音频
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  m4a: "audio/mp4",
  flac: "audio/flac",
  ogg: "audio/ogg",
};

export function getMime(ext: string): string {
  const key = ext.toLowerCase().replace(/^\./, "");
  return MIME_MAP[key] ?? "application/octet-stream";
}

function getMimeFromPath(path: string): string {
  const ext = path.split(".").pop() ?? "";
  return getMime(ext);
}

/**
 * 读取本地文件，转换为 data URL 格式（data:mime/type;base64,...）
 * Rust 侧已内建大小校验（图片≤30MB，视频≤50MB，音频≤15MB），
 * 超过限制时 Rust 会抛出明确错误，透传到前端。
 */
export async function readFileAsDataUrl(absPath: string): Promise<string> {
  const mime = getMimeFromPath(absPath);
  const base64: string = await invoke("read_file_as_base64", { path: absPath });
  return `data:${mime};base64,${base64}`;
}

/**
 * 读取多个本地文件并转为 data URL（并发）
 * 错误时记录错误信息，保持索引对齐
 */
export async function readFilesAsDataUrls(
  paths: string[],
): Promise<{ dataUrls: (string | null)[]; errors: string[] }> {
  const results = await Promise.all(
    paths.map(async (path): Promise<{ path: string; url: string | null; error: string | null }> => {
      try {
        const url = await readFileAsDataUrl(path);
        return { path, url, error: null };
      } catch (err) {
        return { path, url: null, error: String(err instanceof Error ? err.message : err) };
      }
    }),
  );

  return {
    dataUrls: results.map((r) => r.url),
    errors: results.filter((r) => r.error !== null).map((r) => `${r.path}: ${r.error}`),
  };
}
