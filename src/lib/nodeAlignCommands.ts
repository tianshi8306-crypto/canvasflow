import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";

export type AlignOp = "left" | "right" | "top" | "bottom" | "centerH" | "centerV";
export type DistributeOp = "horizontal" | "vertical";

type Box = { id: string; left: number; right: number; top: number; bottom: number; cx: number; cy: number };

function toBox(n: Node<FlowNodeData>): Box {
  const { w, h } = nodeLayoutDimensions(n);
  const left = n.position.x;
  const top = n.position.y;
  return {
    id: n.id,
    left,
    right: left + w,
    top,
    bottom: top + h,
    cx: left + w / 2,
    cy: top + h / 2,
  };
}

function selectionBounds(boxes: Box[]) {
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
    cx: 0,
    cy: 0,
  };
}

/** 相对选区外接矩形对齐 */
export function computeAlignedPositions(
  nodes: Node<FlowNodeData>[],
  op: AlignOp,
): Map<string, { x: number; y: number }> {
  if (nodes.length < 2) return new Map();

  const boxes = nodes.map(toBox);
  const sel = selectionBounds(boxes);
  sel.cx = (sel.left + sel.right) / 2;
  sel.cy = (sel.top + sel.bottom) / 2;

  const out = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const b = boxes.find((x) => x.id === n.id)!;
    let x = n.position.x;
    let y = n.position.y;
    const w = b.right - b.left;
    const h = b.bottom - b.top;

    switch (op) {
      case "left":
        x = sel.left;
        break;
      case "right":
        x = sel.right - w;
        break;
      case "top":
        y = sel.top;
        break;
      case "bottom":
        y = sel.bottom - h;
        break;
      case "centerH":
        x = sel.cx - w / 2;
        break;
      case "centerV":
        y = sel.cy - h / 2;
        break;
      default:
        break;
    }
    out.set(n.id, { x, y });
  }
  return out;
}

/** 首尾固定，中间等间距（Figma 式分布） */
export function computeDistributedPositions(
  nodes: Node<FlowNodeData>[],
  op: DistributeOp,
): Map<string, { x: number; y: number }> {
  if (nodes.length < 3) return new Map();

  const boxes = nodes.map(toBox);
  const out = new Map<string, { x: number; y: number }>();

  if (op === "horizontal") {
    const sorted = [...boxes].sort((a, b) => a.left - b.left || a.top - b.top);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const span = last.right - first.left;
    const sumW = sorted.reduce((s, b) => s + (b.right - b.left), 0);
    const gap = (span - sumW) / (sorted.length - 1);
    let x = first.left;
    for (const b of sorted) {
      const n = nodes.find((nn) => nn.id === b.id)!;
      out.set(b.id, { x, y: n.position.y });
      x += b.right - b.left + gap;
    }
    return out;
  }

  const sorted = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = last.bottom - first.top;
  const sumH = sorted.reduce((s, b) => s + (b.bottom - b.top), 0);
  const gap = (span - sumH) / (sorted.length - 1);
  let y = first.top;
  for (const b of sorted) {
    const n = nodes.find((nn) => nn.id === b.id)!;
    out.set(b.id, { x: n.position.x, y });
    y += b.bottom - b.top + gap;
  }
  return out;
}

export function alignOpLabel(op: AlignOp): string {
  const labels: Record<AlignOp, string> = {
    left: "左对齐",
    right: "右对齐",
    top: "顶对齐",
    bottom: "底对齐",
    centerH: "水平居中",
    centerV: "垂直居中",
  };
  return labels[op];
}

export function distributeOpLabel(op: DistributeOp): string {
  return op === "horizontal" ? "水平等距" : "垂直等距";
}
