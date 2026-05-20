import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { resolveAssetRelPath } from "@/shared/api/assets";

export type ImageEditSubAction =
  | "hd"
  | "outpaint"
  | "redraw"
  | "crop"
  | "panorama"
  | "multiAngle"
  | "grid9"
  | "grid4"
  | "grid9MultiCam"
  | "head3view"
  | "product3view"
  | "grid25"
  | "person3view";

export type ImageEditIntent = {
  active: boolean;
  subAction?: ImageEditSubAction;
};

const EDIT_SUFFIX: Partial<Record<ImageEditSubAction, string>> = {
  hd: "提升清晰度与细节，保持画面内容与构图不变。",
  outpaint: "扩展画幅并自然延伸场景，保持主体一致。",
  redraw: "在保持构图的前提下按描述重绘画面。",
  crop: "按描述调整构图与裁切范围，输出完整画面。",
};

export function getImageEditIntent(data: FlowNodeData | undefined): ImageEditIntent {
  const params = data?.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return { active: false };
  }
  const raw = params.imageEditIntent;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { active: false };
  }
  const active = Boolean((raw as { active?: unknown }).active);
  const sub = (raw as { subAction?: unknown }).subAction;
  const subAction =
    typeof sub === "string" && sub.trim() ? (sub.trim() as ImageEditSubAction) : undefined;
  return { active, subAction };
}

export function imageEditIntentParams(intent: ImageEditIntent): Record<string, unknown> {
  return {
    imageEditIntent: {
      active: intent.active,
      ...(intent.subAction ? { subAction: intent.subAction } : {}),
    },
  };
}

export async function resolveLocalNodeImagePath(
  projectPath: string | null | undefined,
  node: Node<FlowNodeData> | undefined,
): Promise<string | null> {
  if (!node) return null;
  return resolveAssetRelPath(projectPath, node.data.path, node.data.assetId);
}

export function appendImageEditPromptSuffix(
  aggregatedPrompt: string,
  subAction?: ImageEditSubAction,
): string {
  const base = aggregatedPrompt.trim();
  if (!subAction) return base;
  const suffix = EDIT_SUFFIX[subAction];
  if (!suffix) return base;
  if (base.includes(suffix)) return base;
  return base ? `${base}\n\n${suffix}` : suffix;
}

export function isImageEditSubAction(value: string): value is ImageEditSubAction {
  return (
    value === "hd" ||
    value === "outpaint" ||
    value === "redraw" ||
    value === "crop" ||
    value === "panorama" ||
    value === "multiAngle" ||
    value === "grid9" ||
    value === "grid4" ||
    value === "grid9MultiCam" ||
    value === "head3view" ||
    value === "product3view" ||
    value === "grid25" ||
    value === "person3view"
  );
}
