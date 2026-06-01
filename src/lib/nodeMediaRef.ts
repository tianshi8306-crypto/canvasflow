/**
 * 媒体节点资产引用约定（迭代 17，已冻结）。
 * 写：commitNodeMediaPatch · 读：resolveNodeMediaRelPath · 打开工程由 Tauri reconcile。
 */
import type { FlowNodeData } from "@/lib/types";
import { resolveAssetRelPath } from "@/shared/api/assets";

/** 画布上携带本地媒体文件的节点类型（与 Rust `canvas_asset_backfill` 一致） */export const CANVAS_MEDIA_NODE_TYPES = [
  "imageNode",
  "imageAsset",
  "videoNode",
  "audioNode",
  "mediaImport",
] as const;

export type CanvasMediaNodeType = (typeof CANVAS_MEDIA_NODE_TYPES)[number];

export function isCanvasMediaNodeType(type: string | undefined): type is CanvasMediaNodeType {
  return CANVAS_MEDIA_NODE_TYPES.includes(type as CanvasMediaNodeType);
}

/** 节点是否已绑定可解析的媒体（`path` 或 `assetId` 至少一项非空） */
export function hasNodeMedia(data: Pick<FlowNodeData, "path" | "assetId"> | undefined): boolean {
  if (!data) return false;
  return Boolean(data.path?.trim() || data.assetId?.trim());
}

/** 读取节点上存储的媒体引用（未解析为绝对路径） */
export function nodeMediaRef(
  data: Pick<FlowNodeData, "path" | "assetId"> | undefined,
): { path?: string; assetId?: string } {
  const path = data?.path?.trim() || undefined;
  const assetId = data?.assetId?.trim() || undefined;
  return { path, assetId };
}

/**
 * M4：写入节点媒体字段（双写，`assetId` 为真源；`path` 为索引派生缓存）。
 */
export function commitNodeMediaPatch(
  relPath: string,
  assetId?: string | null,
): Pick<FlowNodeData, "path" | "assetId"> {
  const path = relPath.trim();
  const id = assetId?.trim();
  return id ? { path, assetId: id } : { path };
}

/** 解析当前工程下的权威相对路径（优先 `assetId` 查库）。 */
export async function resolveNodeMediaRelPath(
  projectPath: string | null | undefined,
  data: Pick<FlowNodeData, "path" | "assetId"> | undefined,
): Promise<string | null> {
  const { path, assetId } = nodeMediaRef(data);
  return resolveAssetRelPath(projectPath, path, assetId);
}
