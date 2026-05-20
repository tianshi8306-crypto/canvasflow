/**
 * Tauri 桌面端：通过系统「打开文件」对话框拿到本机绝对路径。
 * WebView 里 `<input type="file">` 与 HTML5 拖放拿到的 `File` 通常没有 `path`，无法满足 Rust 侧 `import_media_files` 的复制需求。
 */
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

function normalize(selected: string | string[] | null): string[] | null {
  if (selected === null) return null;
  return Array.isArray(selected) ? selected : [selected];
}

export async function pickMediaPathsForImport(multiple: boolean): Promise<string[] | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple,
    filters: [
      {
        name: "媒体",
        extensions: [
          "png",
          "jpg",
          "jpeg",
          "webp",
          "bmp",
          "gif",
          "mp4",
          "mov",
          "webm",
          "avi",
          "mkv",
          "mp3",
          "wav",
          "m4a",
          "flac",
          "ogg",
        ],
      },
    ],
  });
  return normalize(selected);
}

export async function pickImagePathsForImport(multiple: boolean): Promise<string[] | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple,
    filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
  });
  return normalize(selected);
}

export async function pickVideoPathsForImport(multiple: boolean): Promise<string[] | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple,
    filters: [{ name: "视频", extensions: ["mp4", "mov", "webm", "avi", "mkv", "m4v", "mpeg", "mpg"] }],
  });
  return normalize(selected);
}

export async function pickAudioPathsForImport(multiple: boolean): Promise<string[] | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple,
    filters: [{ name: "音频", extensions: ["mp3", "wav", "m4a", "flac", "ogg"] }],
  });
  return normalize(selected);
}
