import type { Edge, Node, Viewport } from "@xyflow/react";
import { sanitizeCanvasEdges } from "@/lib/flowConnectionPolicy";
import type { FlowNodeData } from "./types";

export const defaultViewport: Viewport = { x: 0, y: 0, zoom: 1 };

// ═══════════════════════════════════════════════════════════════════════════════
// 版本迁移类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 当前最新版本号 */
export const CURRENT_CANVAS_VERSION = 2;

/** 旧版 v0 canvas（无 version 字段） */
interface CanvasV0 {
  version?: never;
  viewport?: unknown;
  nodes?: unknown[];
  edges?: unknown[];
  [key: string]: unknown;
}

/** 最新版 canvas (v1) */
interface CanvasV1 {
  version: number;
  viewport?: unknown;
  nodes?: unknown[];
  edges?: unknown[];
}

/** v2 工程 meta：节点序号计数器（可选，向后兼容） */
export type CanvasProjectMeta = {
  imageNodeCounter?: number;
  videoNodeCounter?: number;
};

/** v2 canvas（统一图片节点：imageAsset → imageNode） */
interface CanvasV2 {
  version: 2;
  viewport?: unknown;
  nodes?: unknown[];
  edges?: unknown[];
  meta?: CanvasProjectMeta;
}

/** 未经迁移的原始 JSON parsed 对象 */
type UnknownVersion = CanvasV0 | CanvasV1 | Record<string, unknown>;

/**
 * 迁移函数签名：将版本 N 的数据结构转换为版本 N+1
 */
type MigrationFn<TFrom, TTo> = (data: TFrom) => TTo;

/**
 * v0 → v1 迁移：处理旧版工程的 shotSize 字段并入 scene 等历史字段
 * 注意：v0 没有 version 字段，通过检测 shotSize 是否存在来判断
 */
function migrateV0ToV1(data: CanvasV0): CanvasV1 {
  const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];

  // v0 迁移：清理废弃字段
  const migratedNodes = rawNodes.map((node) => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const n = node as Record<string, unknown>;
      if (n.type === "scriptNode" && n.data && typeof n.data === "object") {
        const data = n.data as Record<string, unknown>;
        if (Array.isArray(data.scriptBeats)) {
          const migratedBeats = (data.scriptBeats as Array<Record<string, unknown>>).map((beat) => {
            // v0: shotSize 存在时覆盖 scene（旧版 shot 字段迁移到 shotSize）
            if (beat.shotSize && !beat.scene) {
              return { ...beat, scene: beat.shotSize };
            }
            return beat;
          });
          return {
            ...n,
            data: {
              ...data,
              scriptBeats: migratedBeats,
            },
          };
        }
      }
    }
    return node;
  });

  return {
    version: 1,
    viewport: data.viewport,
    nodes: migratedNodes,
    edges: data.edges,
  };
}

/**
 * v1 → v2 迁移：统一图片节点类型（imageAsset → imageNode）
 * imageAsset 和 imageNode 合并为唯一的 imageNode
 */
function migrateV1ToV2(data: CanvasV1): CanvasV2 {
  const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];

  const migratedNodes = rawNodes.map((node) => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const n = node as Record<string, unknown>;
      // imageAsset → imageNode
      if (n.type === "imageAsset") {
        return { ...n, type: "imageNode" };
      }
    }
    return node;
  });

  return {
    version: 2,
    viewport: data.viewport,
    nodes: migratedNodes,
    edges: data.edges,
  };
}

// 迁移链：按顺序应用
const migrations: Array<{ from: number; to: number; fn: MigrationFn<unknown, unknown> }> = [
  { from: 0, to: 1, fn: migrateV0ToV1 as MigrationFn<unknown, unknown> },
  { from: 1, to: 2, fn: migrateV1ToV2 as MigrationFn<unknown, unknown> },
];

/**
 * 将任意版本的数据迁移到最新版本
 */
function migrateToLatest(data: UnknownVersion): CanvasV2 {
  let currentVersion: number;
  if (typeof data === "object" && data !== null && "version" in data && typeof data.version === "number") {
    currentVersion = data.version;
  } else {
    // 无 version 字段视为 v0
    currentVersion = 0;
  }

  if (currentVersion > CURRENT_CANVAS_VERSION) {
    console.warn(
      `[Serialization] 文件版本 ${currentVersion} 高于当前支持版本 ${CURRENT_CANVAS_VERSION}，将尽量加载但可能丢失数据`,
    );
    // 对于未来版本，尝试直接使用（可能会丢失新字段）
    return {
      version: currentVersion as 2,
      viewport: (data as CanvasV1).viewport,
      nodes: (data as CanvasV1).nodes,
      edges: (data as CanvasV1).edges,
    };
  }

  let current: UnknownVersion = data;

  // 按顺序应用所有迁移
  while (currentVersion < CURRENT_CANVAS_VERSION) {
    const migration = migrations.find((m) => m.from === currentVersion);
    if (!migration) {
      console.error(`[Serialization] 缺少版本 ${currentVersion} → ${currentVersion + 1} 的迁移函数`);
      break;
    }
    current = migration.fn(current) as UnknownVersion;
    currentVersion++;
  }

  return current as CanvasV2;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Schema 校验
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 校验节点的必要字段
 */
function validateNode(node: unknown): Node<FlowNodeData> | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  // 校验 id
  if (typeof n.id !== "string") return null;
  // type 允许为空（兼容旧数据）
  // data 允许为空（使用默认值）
  return node as Node<FlowNodeData>;
}

/**
 * 校验边的必要字段
 */
function validateEdge(edge: unknown): Edge | null {
  if (!edge || typeof edge !== "object") return null;
  const e = edge as Record<string, unknown>;
  if (typeof e.id !== "string") return null;
  if (typeof e.source !== "string") return null;
  if (typeof e.target !== "string") return null;
  return edge as Edge;
}

/**
 * 校验视口的必要字段
 */
function validateViewport(vp: unknown): Viewport | null {
  if (!vp || typeof vp !== "object") return null;
  const v = vp as Record<string, unknown>;
  if (typeof v.x !== "number" || typeof v.y !== "number") return null;
  if (typeof v.zoom !== "number") return null;
  return vp as Viewport;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 序列化 / 反序列化
// ═══════════════════════════════════════════════════════════════════════════════

function parseCanvasMeta(raw: unknown): CanvasProjectMeta | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  const imageNodeCounter =
    typeof m.imageNodeCounter === "number" && Number.isFinite(m.imageNodeCounter)
      ? Math.max(0, Math.floor(m.imageNodeCounter))
      : undefined;
  const videoNodeCounter =
    typeof m.videoNodeCounter === "number" && Number.isFinite(m.videoNodeCounter)
      ? Math.max(0, Math.floor(m.videoNodeCounter))
      : undefined;
  if (imageNodeCounter == null && videoNodeCounter == null) return undefined;
  return { imageNodeCounter, videoNodeCounter };
}

export function serializeCanvas(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  viewport: Viewport,
  meta?: CanvasProjectMeta,
): string {
  const payload: CanvasV2 = {
    version: CURRENT_CANVAS_VERSION,
    viewport,
    nodes,
    edges,
  };
  if (meta && (meta.imageNodeCounter != null || meta.videoNodeCounter != null)) {
    payload.meta = meta;
  }
  return JSON.stringify(payload, null, 2);
}

export function parseCanvas(raw: string): {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  viewport: Viewport;
  meta?: CanvasProjectMeta;
  /** M2：从磁盘读入时剔除的不兼容连线数量 */
  invalidEdgesDropped: number;
} {
  let parsed: UnknownVersion;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("工程文件格式损坏，无法解析 JSON");
  }

  // 1. 版本迁移
  const migrated = migrateToLatest(parsed);

  // 2. Schema 校验
  if (typeof (migrated as { version?: number }).version !== "number") {
    console.warn("[Serialization] 文件缺少 version 字段，将作为 v0 处理");
  }

  const migratedVersion = (migrated as { version?: number }).version;
  if (migratedVersion !== undefined && migratedVersion > CURRENT_CANVAS_VERSION) {
    console.warn(`[Serialization] 文件版本 ${migratedVersion} 高于当前支持版本 ${CURRENT_CANVAS_VERSION}`);
  }

  // 校验视口
  const viewport = validateViewport(migrated.viewport) ?? defaultViewport;

  // 校验并清理节点
  const rawNodes = Array.isArray(migrated.nodes) ? migrated.nodes : [];
  const nodes = rawNodes.map(validateNode).filter((n): n is Node<FlowNodeData> => n !== null);
  if (nodes.length < rawNodes.length) {
    console.warn(`[Serialization] 过滤了 ${rawNodes.length - nodes.length} 个无效节点`);
  }

  // 校验并清理边
  const rawEdges = Array.isArray(migrated.edges) ? migrated.edges : [];
  const { edges: cleanedEdges, droppedCount } = sanitizeCanvasEdges(nodes, rawEdges as Edge[]);
  const validEdges = rawEdges.map(validateEdge).filter((e): e is Edge => e !== null);
  const invalidEdgeCount = rawEdges.length - validEdges.length;

  const meta = parseCanvasMeta((migrated as CanvasV2).meta);

  return {
    nodes,
    edges: cleanedEdges,
    viewport,
    meta,
    invalidEdgesDropped: droppedCount + invalidEdgeCount,
  };
}
