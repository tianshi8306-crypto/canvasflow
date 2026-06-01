import type { IncomingImagePanelRef, IncomingImageRef } from "@/lib/imageGeneration/types";

export const IMAGE_PARAM_REFERENCE_EDGE_ORDER = "referenceEdgeOrder";

export function readImageReferenceEdgeOrder(
  params?: Record<string, unknown>,
): string[] | undefined {
  const raw = params?.[IMAGE_PARAM_REFERENCE_EDGE_ORDER];
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((x): x is string => typeof x === "string");
}

type EdgeKeyed = { edgeId: string };

/** 将持久化的 edge 顺序应用到参考列表（未知 edge 追加在末尾） */
export function applyPanelRefEdgeOrder<T extends EdgeKeyed>(
  items: T[],
  edgeOrder?: string[],
): T[] {
  if (!edgeOrder?.length) return items;
  const byEdge = new Map(items.map((i) => [i.edgeId, i]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const eid of edgeOrder) {
    const it = byEdge.get(eid);
    if (!it) continue;
    out.push(it);
    seen.add(eid);
  }
  for (const it of items) {
    if (!seen.has(it.edgeId)) out.push(it);
  }
  return out;
}

/** 连线增删后合并 referenceEdgeOrder */
export function syncPanelRefEdgeOrder(
  saved: string[] | undefined,
  items: EdgeKeyed[],
): string[] {
  const ids = items.map((i) => i.edgeId);
  const idSet = new Set(ids);
  const kept = (saved ?? []).filter((id) => idSet.has(id));
  const keptSet = new Set(kept);
  for (const id of ids) {
    if (!keptSet.has(id)) kept.push(id);
  }
  return kept;
}

/** 参考条内拖动换位，返回新的完整 edge 顺序 */
export function reorderPanelRefEdgeOrder<T extends EdgeKeyed>(
  items: T[],
  edgeOrder: string[] | undefined,
  displayEdgeIds: string[],
  fromEdgeId: string,
  toEdgeId: string,
): string[] {
  if (fromEdgeId === toEdgeId) return syncPanelRefEdgeOrder(edgeOrder, items);
  const order = syncPanelRefEdgeOrder(edgeOrder, items);
  const ordered = applyPanelRefEdgeOrder(items, order);
  const stripSet = new Set(displayEdgeIds);
  const stripItems = ordered.filter((i) => stripSet.has(i.edgeId));
  const tailItems = ordered.filter((i) => !stripSet.has(i.edgeId));
  const fromIdx = stripItems.findIndex((i) => i.edgeId === fromEdgeId);
  const toIdx = stripItems.findIndex((i) => i.edgeId === toEdgeId);
  if (fromIdx < 0 || toIdx < 0) return order;
  const nextStrip = [...stripItems];
  const [moved] = nextStrip.splice(fromIdx, 1);
  nextStrip.splice(toIdx, 0, moved);
  return [...nextStrip.map((i) => i.edgeId), ...tailItems.map((i) => i.edgeId)];
}

export function orderIncomingImagePanelRefs(
  refs: IncomingImagePanelRef[],
  edgeOrder?: string[],
): IncomingImagePanelRef[] {
  return applyPanelRefEdgeOrder(refs, syncPanelRefEdgeOrder(edgeOrder, refs));
}

export function applyImageRefEdgeOrder(
  items: IncomingImageRef[],
  edgeOrder?: string[],
): IncomingImageRef[] {
  return applyPanelRefEdgeOrder(items, edgeOrder);
}

export function syncImageReferenceEdgeOrder(
  saved: string[] | undefined,
  items: IncomingImageRef[],
): string[] {
  return syncPanelRefEdgeOrder(saved, items);
}

export function reorderImageRefEdgeOrder(
  items: IncomingImageRef[],
  edgeOrder: string[] | undefined,
  displayEdgeIds: string[],
  fromEdgeId: string,
  toEdgeId: string,
): string[] {
  return reorderPanelRefEdgeOrder(items, edgeOrder, displayEdgeIds, fromEdgeId, toEdgeId);
}

export function orderIncomingImageRefs(
  refs: IncomingImageRef[],
  edgeOrder?: string[],
): IncomingImageRef[] {
  return applyImageRefEdgeOrder(refs, syncPanelRefEdgeOrder(edgeOrder, refs));
}

export function reorderImagePanelRefEdgeOrder(
  items: IncomingImagePanelRef[],
  edgeOrder: string[] | undefined,
  displayEdgeIds: string[],
  fromEdgeId: string,
  toEdgeId: string,
): string[] {
  return reorderPanelRefEdgeOrder(items, edgeOrder, displayEdgeIds, fromEdgeId, toEdgeId);
}

export function syncImagePanelReferenceEdgeOrder(
  saved: string[] | undefined,
  items: IncomingImagePanelRef[],
): string[] {
  return syncPanelRefEdgeOrder(saved, items);
}
