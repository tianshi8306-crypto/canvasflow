import { getBezierPath, type Node } from "@xyflow/react";
import { getAnchorHandleFlowPosition } from "@/lib/anchorHandleGeometry";
import type { FlowNodeData } from "@/lib/types";

/** 指针离路径超过该距离（px）时隐藏删除钮 */
export const EDGE_DELETE_MAX_DISTANCE_PX = 28;

const PATH_SAMPLE_STEPS = 72;

export type ScreenPoint = { x: number; y: number };

export type ClosestOnEdgePath = ScreenPoint & { distance: number; /** 0–1，沿路径长度比例 */ pathT: number };

function buildEdgeScreenPath(
  sourceNode: Node<FlowNodeData>,
  targetNode: Node<FlowNodeData>,
  flowToScreenPosition: (p: { x: number; y: number }) => ScreenPoint,
): string {
  const src = getAnchorHandleFlowPosition(sourceNode, "source");
  const tgt = getAnchorHandleFlowPosition(targetNode, "target");
  const s = flowToScreenPosition({ x: src.x, y: src.y });
  const t = flowToScreenPosition({ x: tgt.x, y: tgt.y });
  const [path] = getBezierPath({
    sourceX: s.x,
    sourceY: s.y,
    sourcePosition: src.position,
    targetX: t.x,
    targetY: t.y,
    targetPosition: tgt.position,
  });
  return path;
}

let measureSvgRoot: SVGSVGElement | null = null;

function measurePathElement(pathD: string): SVGPathElement | null {
  if (typeof document === "undefined") return null;
  if (!measureSvgRoot) {
    measureSvgRoot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    measureSvgRoot.setAttribute("width", "0");
    measureSvgRoot.setAttribute("height", "0");
    measureSvgRoot.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    document.body.appendChild(measureSvgRoot);
  }
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  measureSvgRoot.appendChild(path);
  return path;
}

function releaseMeasurePath(path: SVGPathElement) {
  path.remove();
}

/** jsdom 等环境无 getTotalLength 时，仅支持 M…L… 直线段 */
function closestOnLinePathFallback(
  pathD: string,
  clientX: number,
  clientY: number,
): ClosestOnEdgePath | null {
  const m = /^M\s*([-\d.]+)\s+([-\d.]+)\s+L\s*([-\d.]+)\s+([-\d.]+)\s*$/i.exec(
    pathD.trim(),
  );
  if (!m) return null;
  const x1 = Number(m[1]);
  const y1 = Number(m[2]);
  const x2 = Number(m[3]);
  const y2 = Number(m[4]);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) {
    return { x: x1, y: y1, distance: Math.hypot(clientX - x1, clientY - y1), pathT: 0 };
  }
  const t = Math.max(0, Math.min(1, ((clientX - x1) * dx + (clientY - y1) * dy) / len2));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return { x, y, distance: Math.hypot(clientX - x, clientY - y), pathT: t };
}

/** 在贝塞尔路径上找距 client 最近的点（屏幕坐标） */
export function closestPointOnEdgePath(
  pathD: string,
  clientX: number,
  clientY: number,
): ClosestOnEdgePath {
  const path = measurePathElement(pathD);
  if (!path || typeof path.getTotalLength !== "function") {
    const fb = closestOnLinePathFallback(pathD, clientX, clientY);
    return (
      fb ?? {
        x: clientX,
        y: clientY,
        distance: Infinity,
        pathT: 0.5,
      }
    );
  }
  const total = path.getTotalLength();
  if (total <= 0) {
    releaseMeasurePath(path);
    return { x: clientX, y: clientY, distance: 0, pathT: 0.5 };
  }

  let bestX = clientX;
  let bestY = clientY;
  let bestDist = Infinity;
  let bestLen = 0;

  for (let i = 0; i <= PATH_SAMPLE_STEPS; i++) {
    const len = (total * i) / PATH_SAMPLE_STEPS;
    const pt = path.getPointAtLength(len);
    const dx = pt.x - clientX;
    const dy = pt.y - clientY;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestX = pt.x;
      bestY = pt.y;
      bestLen = len;
    }
  }

  const refineRadius = total / PATH_SAMPLE_STEPS;
  let lo = Math.max(0, bestLen - refineRadius);
  let hi = Math.min(total, bestLen + refineRadius);
  for (let r = 0; r < 8; r++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const p1 = path.getPointAtLength(m1);
    const p2 = path.getPointAtLength(m2);
    const d1 = Math.hypot(p1.x - clientX, p1.y - clientY);
    const d2 = Math.hypot(p2.x - clientX, p2.y - clientY);
    if (d1 < d2) {
      hi = m2;
      if (d1 < bestDist) {
        bestDist = d1;
        bestX = p1.x;
        bestY = p1.y;
        bestLen = m1;
      }
    } else {
      lo = m1;
      if (d2 < bestDist) {
        bestDist = d2;
        bestX = p2.x;
        bestY = p2.y;
        bestLen = m2;
      }
    }
  }

  releaseMeasurePath(path);
  return { x: bestX, y: bestY, distance: bestDist, pathT: total > 0 ? bestLen / total : 0.5 };
}

/** 按路径长度比例取屏幕坐标（选中后平移/缩放时重算剪刀位置） */
export function pointOnEdgePathAtRatio(pathD: string, pathT: number): ScreenPoint | null {
  const t = Math.max(0, Math.min(1, pathT));
  const path = measurePathElement(pathD);
  if (!path || typeof path.getTotalLength !== "function") {
    const m = /^M\s*([-\d.]+)\s+([-\d.]+)\s+L\s*([-\d.]+)\s+([-\d.]+)\s*$/i.exec(
      pathD.trim(),
    );
    if (!m) return null;
    const x1 = Number(m[1]);
    const y1 = Number(m[2]);
    const x2 = Number(m[3]);
    const y2 = Number(m[4]);
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
  }
  const total = path.getTotalLength();
  if (total <= 0) {
    releaseMeasurePath(path);
    return null;
  }
  const pt = path.getPointAtLength(total * t);
  releaseMeasurePath(path);
  return { x: pt.x, y: pt.y };
}

export function pointOnEdgeScreenAtRatio(
  sourceNode: Node<FlowNodeData> | undefined,
  targetNode: Node<FlowNodeData> | undefined,
  flowToScreenPosition: (p: { x: number; y: number }) => ScreenPoint,
  pathT: number,
): ScreenPoint | null {
  if (!sourceNode || !targetNode) return null;
  const pathD = buildEdgeScreenPath(sourceNode, targetNode, flowToScreenPosition);
  return pointOnEdgePathAtRatio(pathD, pathT);
}

export function projectPointerOnEdge(
  sourceNode: Node<FlowNodeData> | undefined,
  targetNode: Node<FlowNodeData> | undefined,
  clientX: number,
  clientY: number,
  flowToScreenPosition: (p: { x: number; y: number }) => ScreenPoint,
): ClosestOnEdgePath | null {
  if (!sourceNode || !targetNode) return null;
  const pathD = buildEdgeScreenPath(sourceNode, targetNode, flowToScreenPosition);
  return closestPointOnEdgePath(pathD, clientX, clientY);
}

/** 连线路径中点（屏幕坐标）；无点选落点时的回退 */
export function midpointOnEdgeScreen(
  sourceNode: Node<FlowNodeData> | undefined,
  targetNode: Node<FlowNodeData> | undefined,
  flowToScreenPosition: (p: { x: number; y: number }) => ScreenPoint,
): ScreenPoint | null {
  return pointOnEdgeScreenAtRatio(sourceNode, targetNode, flowToScreenPosition, 0.5);
}
