import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { stripEphemeralNodeFields } from "@/lib/reactFlowControlled";
import {
  CURRENT_CANVAS_VERSION,
  serializeCanvas,
  type CanvasProjectMeta,
  type SerializeCanvasOptions,
} from "@/lib/serialization";

/** 去掉 RF 运行时字段，减小序列化体积与耗时 */
function stripNodeForPersist(node: Node<FlowNodeData>): Node<FlowNodeData> {
  const n = node as Node<FlowNodeData> & {
    selected?: boolean;
    dragging?: boolean;
    measured?: unknown;
    positionAbsolute?: unknown;
  };
  const { selected: _s, dragging: _d, measured: _m, positionAbsolute: _p, ...kept } = n;
  return kept as Node<FlowNodeData>;
}

function stripEdgeForPersist(edge: Edge): Edge {
  const e = edge as Edge & { selected?: boolean };
  const { selected: _s, ...kept } = e;
  return kept;
}

export function prepareCanvasForPersist(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  return {
    nodes: stripEphemeralNodeFields(nodes).map(stripNodeForPersist),
    edges: edges.map(stripEdgeForPersist),
  };
}

function runWhenIdle(run: () => void, timeoutMs = 8000): void {
  const sched = (
    globalThis as typeof globalThis & {
      scheduler?: { postTask: (fn: () => void, opts?: { priority?: string }) => void };
    }
  ).scheduler;
  if (sched?.postTask) {
    sched.postTask(run, { priority: "background" });
    return;
  }
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: timeoutMs });
    return;
  }
  window.setTimeout(run, 16);
}

/** 浏览器空闲时在主线程序列化（避免 worker postMessage 整图结构化克隆更卡） */
export function serializeCanvasToBytesAsync(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  viewport: Viewport,
  meta?: CanvasProjectMeta,
  options?: SerializeCanvasOptions,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    runWhenIdle(() => {
      try {
        const prepared = prepareCanvasForPersist(nodes, edges);
        const json = serializeCanvas(prepared.nodes, prepared.edges, viewport, meta, options);
        resolve(new TextEncoder().encode(json));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}

/** @deprecated 使用 serializeCanvasToBytesAsync */
export async function serializeCanvasAsync(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  viewport: Viewport,
  meta?: CanvasProjectMeta,
  options?: SerializeCanvasOptions,
): Promise<string> {
  const bytes = await serializeCanvasToBytesAsync(nodes, edges, viewport, meta, options);
  return new TextDecoder().decode(bytes);
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function buildPersistPayloadBytes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  viewport: Viewport,
  meta?: CanvasProjectMeta,
): Uint8Array {
  const prepared = prepareCanvasForPersist(nodes, edges);
  const json = serializeCanvas(prepared.nodes, prepared.edges, viewport, meta, {
    pretty: false,
  });
  return new TextEncoder().encode(json);
}

/** 供诊断：估算持久化 JSON 体积 */
export function estimatePersistPayloadBytes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  viewport: Viewport,
  meta?: CanvasProjectMeta,
): number {
  return buildPersistPayloadBytes(nodes, edges, viewport, meta).byteLength;
}

export { CURRENT_CANVAS_VERSION };
