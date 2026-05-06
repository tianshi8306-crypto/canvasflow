import { CAMERA_PRESETS } from "@/lib/ttvCameraPresets";
import type {
  CameraCustomMove,
  CameraMovementDraft,
  VideoGenerationDraft,
} from "@/lib/videoNodeTypes";

export function cardLabelFromMove(m: CameraCustomMove): string {
  const n = m.name.trim();
  if (n) return n;
  const p = m.prompt.trim();
  if (!p) return "未命名运镜";
  const line = p.split(/\r?\n/)[0] ?? p;
  return line.length > 16 ? `${line.slice(0, 16)}…` : line;
}

/** 提示词输入框内运镜标签展示文案 */
export function getCameraChipLabel(cm: CameraMovementDraft | undefined): string | null {
  if (!cm) return null;
  if (cm.presetId) {
    return CAMERA_PRESETS.find((p) => p.id === cm.presetId)?.label ?? null;
  }
  if (cm.selectedCustomMoveId && cm.customMoves) {
    const raw = cm.customMoves.find((x) => {
      if (!x || typeof x !== "object") return false;
      return (x as CameraCustomMove).id === cm.selectedCustomMoveId;
    }) as CameraCustomMove | undefined;
    return raw ? cardLabelFromMove(raw) : null;
  }
  return null;
}

/** 输入框内标签展示（与产品图一致：方括号包裹，表示插在正文中的「运镜块」） */
export function getCameraChipDisplayLabel(cm: CameraMovementDraft | undefined): string | null {
  const inner = getCameraChipLabel(cm);
  if (!inner) return null;
  return `[${inner}]`;
}

/** 参与融合的实际运镜文本（预设为结构化前缀，自定义为运镜提示词全文） */
export function getCameraPromptPart(draft: VideoGenerationDraft): string | null {
  const cm = draft.cameraMovement;
  if (!cm) return null;
  if (cm.presetId) {
    const label = CAMERA_PRESETS.find((p) => p.id === cm.presetId)?.label;
    return label ? `【运镜：${label}】` : null;
  }
  if (cm.selectedCustomMoveId && cm.customMoves) {
    const raw = cm.customMoves.find((x) => {
      if (!x || typeof x !== "object") return false;
      return (x as CameraCustomMove).id === cm.selectedCustomMoveId;
    }) as CameraCustomMove | undefined;
    const t = raw?.prompt?.trim() ?? "";
    return t || null;
  }
  return null;
}

/** 解析插入下标（兼容旧 tagPlacement） */
export function getCameraInsertIndex(cm: CameraMovementDraft | undefined, promptLen: number): number {
  if (!cm) return 0;
  if (typeof cm.insertIndex === "number" && Number.isFinite(cm.insertIndex)) {
    return Math.max(0, Math.min(promptLen, Math.floor(cm.insertIndex)));
  }
  if (cm.tagPlacement === "after_prompt") return promptLen;
  return 0;
}

function fuseAtInsert(cam: string, body: string, insertIndex: number): string {
  const i = Math.max(0, Math.min(insertIndex, body.length));
  return body.slice(0, i) + cam + body.slice(i);
}

/**
 * 生成请求中的完整提示词：在用户输入的 `prompt` 指定位置插入运镜文本（无需用户单独编写运镜句）
 */
export function buildMergedGenerationPrompt(draft: VideoGenerationDraft): string {
  const body = draft.prompt ?? "";
  const camPart = getCameraPromptPart(draft);
  if (!camPart) return body;
  const cm = draft.cameraMovement;
  const idx = getCameraInsertIndex(cm, body.length);
  return fuseAtInsert(camPart, body, idx);
}
