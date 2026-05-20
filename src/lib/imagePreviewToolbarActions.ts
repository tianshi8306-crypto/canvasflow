import type { ImageEditSubAction } from "@/lib/imageGeneration/imageEditIntent";
import { BUILT_IN_PRESETS, USER_INPUT_PLACEHOLDER } from "@/lib/slashPresets";

export type ImagePreviewToolbarActionKind = "edit" | "preset" | "utility" | "stub";

export type ImagePreviewToolbarAction = {
  id: string;
  label: string;
  kind: ImagePreviewToolbarActionKind;
  presetId?: string;
  subAction?: ImageEditSubAction;
  stubMessage?: string;
};

export type ImagePreviewToolbarGroup = {
  id: string;
  label: string;
  actions: ImagePreviewToolbarAction[];
};

export const IMAGE_PREVIEW_TOOLBAR_GROUPS: ImagePreviewToolbarGroup[] = [
  {
    id: "general",
    label: "通用",
    actions: [
      { id: "panorama", label: "全景", kind: "preset", presetId: "builtin-panorama" },
      { id: "multiAngle", label: "多角度", kind: "preset", presetId: "builtin-multi-angle" },
    ],
  },
  {
    id: "grid",
    label: "九宫格",
    actions: [
      { id: "grid9MultiCam", label: "多机位九宫格", kind: "preset", presetId: "builtin-grid-9-multicam" },
      { id: "grid4", label: "剧情四宫格", kind: "preset", presetId: "builtin-grid-4" },
      { id: "head3view", label: "角色头部三视图", kind: "preset", presetId: "builtin-person-3view-face" },
      { id: "product3view", label: "产品三视图", kind: "preset", presetId: "builtin-product-3view" },
      {
        id: "grid25",
        label: "25宫格",
        kind: "stub",
        stubMessage: "25 宫格连续分镜即将支持",
      },
      { id: "person3view", label: "角色三视图", kind: "preset", presetId: "builtin-person-3view" },
    ],
  },
  {
    id: "imageEdit",
    label: "图片编辑",
    actions: [
      { id: "hd", label: "高清", kind: "edit", subAction: "hd" },
      { id: "outpaint", label: "扩图", kind: "edit", subAction: "outpaint" },
      { id: "redraw", label: "重绘", kind: "edit", subAction: "redraw" },
      { id: "crop", label: "裁剪", kind: "edit", subAction: "crop" },
    ],
  },
  {
    id: "tools",
    label: "工具",
    actions: [
      {
        id: "rotate",
        label: "旋转",
        kind: "stub",
        stubMessage: "画布旋转即将支持，请先在预览区查看",
      },
      { id: "upload", label: "上传", kind: "utility" },
      { id: "download", label: "下载", kind: "utility" },
      { id: "maximize", label: "放大预览", kind: "utility" },
    ],
  },
];

export function resolvePresetPrompt(presetId: string, userHint: string): string | null {
  const preset = BUILT_IN_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const hint = userHint.trim() || "当前画面";
  return preset.template.split(USER_INPUT_PLACEHOLDER).join(hint).trim();
}

export async function downloadProjectImage(
  projectPath: string,
  relPath: string,
  fileName: string,
): Promise<void> {
  const { join } = await import("@tauri-apps/api/path");
  const { convertFileSrc, isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) return;
  const abs = await join(projectPath, relPath);
  const url = convertFileSrc(abs);
  const res = await fetch(url);
  if (!res.ok) throw new Error("读取图片失败");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
