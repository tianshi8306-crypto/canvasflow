import { isTauri } from "@tauri-apps/api/core";

import { invoke } from "@tauri-apps/api/core";

import { save } from "@tauri-apps/plugin-dialog";

export type VideoPreviewToolbarActionKind = "stub" | "utility" | "menu" | "workflow";

export type VideoPreviewToolbarMenuMode =
  | "vocal"
  | "bgm"
  | "trim"
  | "concat"
  | "subtitle-auto"
  | "subtitle-region";

export type VideoPreviewToolbarMenuOption = {
  id: string;
  label: string;
  mode?: VideoPreviewToolbarMenuMode;
  stubMessage?: string;
};

export type VideoPreviewToolbarItem = {
  id: string;

  label: string;

  kind: VideoPreviewToolbarActionKind;

  hasMenu?: boolean;

  stubMessage?: string;

  menuOptions?: VideoPreviewToolbarMenuOption[];
};

/** 预览顶栏主区：对齐 LibTV 2.3 视频工具 + 参考图胶囊布局 */

export const VIDEO_PREVIEW_TOOLBAR_PRIMARY: VideoPreviewToolbarItem[] = [
  {
    id: "clip",
    label: "剪辑",
    kind: "menu",
    hasMenu: true,
    menuOptions: [
      { id: "clip-trim", label: "单段裁剪", mode: "trim" },
      { id: "clip-concat", label: "多段合成", mode: "concat" },
    ],
  },

  {
    id: "hd",

    label: "高清",

    kind: "workflow",
  },

  {
    id: "parse",

    label: "解析",

    kind: "workflow",
  },

  {
    id: "subtitle",

    label: "智能去字幕",

    kind: "menu",

    hasMenu: true,

    menuOptions: [
      { id: "subtitle-auto", label: "自动去除", mode: "subtitle-auto" },
      { id: "subtitle-region", label: "框选去除", mode: "subtitle-region" },
    ],
  },

  {
    id: "audioSplit",

    label: "音频分离",

    kind: "menu",

    hasMenu: true,

    menuOptions: [
      { id: "audio-vocal", label: "提取人声", mode: "vocal" },
      { id: "audio-bgm", label: "提取背景音乐", mode: "bgm" },
    ],
  },
];

/** 预览顶栏右侧：下载、展开（上传在预览区右上角） */

export const VIDEO_PREVIEW_TOOLBAR_UTILITY: VideoPreviewToolbarItem[] = [
  { id: "download", label: "下载", kind: "utility" },

  { id: "maximize", label: "展开", kind: "utility" },
];

/** Tauri：系统另存为复制工程内视频 */

export async function downloadProjectVideoWithDialog(
  projectPath: string,

  relPath: string,

  defaultName: string,
): Promise<boolean> {
  if (!isTauri()) return false;

  const dest = await save({
    title: "下载视频",

    defaultPath: defaultName,

    filters: [
      { name: "视频", extensions: ["mp4", "mov", "webm", "mkv"] },

      { name: "所有文件", extensions: ["*"] },
    ],
  });

  if (!dest) return false;

  await invoke("copy_project_file", {
    projectPath,

    relPath,

    destPath: dest,
  });

  return true;
}
