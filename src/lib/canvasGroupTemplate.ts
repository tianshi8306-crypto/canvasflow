import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { cloneFlowNodeData } from "@/lib/flowNodeDataClone";
import { makeFlowEdge } from "@/lib/flowEdge";
import { computeGroupSizeFromMembers } from "@/lib/canvasGroup";
import { getOutputPortType } from "@/lib/flowConnectionPolicy";

export const CANVAS_GROUP_TEMPLATES_STORAGE_KEY = "canvasflow.groupTemplates.v1";
export const GROUP_TEMPLATE_REL_DIR = ".canvasflow/templates";

export type CanvasGroupTemplateNodeV1 = {
  localId: string;
  type: string;
  position: { x: number; y: number };
  data: FlowNodeData;
  style?: Node<FlowNodeData>["style"];
  width?: number;
  height?: number;
};

export type CanvasGroupTemplateEdgeV1 = {
  sourceLocalId: string;
  targetLocalId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Edge["data"];
};

export type CanvasGroupTemplateV1 = {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  group: {
    data: FlowNodeData;
    style?: Node<FlowNodeData>["style"];
    width: number;
    height: number;
  };
  nodes: CanvasGroupTemplateNodeV1[];
  edges: CanvasGroupTemplateEdgeV1[];
};

export type CanvasGroupTemplateListItem = {
  id: string;
  name: string;
  createdAt: number;
  relPath?: string;
};

const SENSITIVE_PARAM_KEYS = new Set([
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "secret",
]);

function sanitizeNodeData(data: FlowNodeData): FlowNodeData {
  const next = cloneFlowNodeData(data);
  delete next.path;
  delete next.assetId;
  delete next.imageWidth;
  delete next.imageHeight;
  delete next.status;
  if (next.params && typeof next.params === "object") {
    const p = { ...next.params } as Record<string, unknown>;
    for (const key of Object.keys(p)) {
      if (SENSITIVE_PARAM_KEYS.has(key)) delete p[key];
    }
    next.params = p;
  }
  if (next.video?.draft) {
    next.video = {
      ...next.video,
      draft: { ...next.video.draft, prompt: next.video.draft.prompt ?? "" },
    };
  }
  return next;
}

function sanitizeGroupData(data: FlowNodeData): FlowNodeData {
  const next = sanitizeNodeData(data);
  delete next.groupScriptNodeId;
  delete next.groupScriptBeatIds;
  next.groupKind = "workflow";
  return next;
}

export function buildGroupTemplateSnapshot(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  groupId: string,
  name: string,
): CanvasGroupTemplateV1 | null {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return null;
  const members = nodes.filter((n) => n.parentId === groupId && n.type !== "group");
  const memberIds = new Set(members.map((m) => m.id));
  const localId = (id: string) => id;

  const width =
    typeof group.style?.width === "number"
      ? group.style.width
      : computeGroupSizeFromMembers(members).width;
  const height =
    typeof group.style?.height === "number"
      ? group.style.height
      : computeGroupSizeFromMembers(members).height;

  return {
    version: 1,
    id: crypto.randomUUID(),
    name: name.trim() || "分组模板",
    createdAt: Date.now(),
    group: {
      data: sanitizeGroupData(group.data),
      style: group.style ? { ...group.style, width, height } : { width, height },
      width,
      height,
    },
    nodes: members.map((n) => ({
      localId: localId(n.id),
      type: n.type ?? "imageNode",
      position: { ...n.position },
      data: sanitizeNodeData(n.data),
      style: n.style,
      width: n.width,
      height: n.height,
    })),
    edges: edges
      .filter((e) => memberIds.has(e.source) && memberIds.has(e.target))
      .map((e) => ({
        sourceLocalId: e.source,
        targetLocalId: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        data: e.data,
      })),
  };
}

export function buildNodesFromGroupTemplate(
  tpl: CanvasGroupTemplateV1,
  worldPosition: { x: number; y: number },
): { nextNodes: Node<FlowNodeData>[]; nextEdges: Edge[] } {
  const groupId = crypto.randomUUID();
  const idMap = new Map<string, string>();
  for (const n of tpl.nodes) {
    idMap.set(n.localId, crypto.randomUUID());
  }

  const groupNode: Node<FlowNodeData> = {
    id: groupId,
    type: "group",
    position: worldPosition,
    data: cloneFlowNodeData(tpl.group.data),
    style: {
      ...tpl.group.style,
      width: tpl.group.width,
      height: tpl.group.height,
      borderRadius: "12px",
      background: "transparent",
    },
    draggable: true,
    selectable: true,
    zIndex: 0,
  };

  const memberNodes: Node<FlowNodeData>[] = tpl.nodes.map((n) => ({
    id: idMap.get(n.localId)!,
    type: n.type,
    position: { ...n.position },
    parentId: groupId,
    data: cloneFlowNodeData(n.data),
    style: n.style,
    width: n.width,
    height: n.height,
    draggable: true,
    selectable: true,
    zIndex: 1,
  }));

  const nextNodes = [groupNode, ...memberNodes];
  const nextEdges: Edge[] = [];
  for (const e of tpl.edges) {
    const src = idMap.get(e.sourceLocalId);
    const tgt = idMap.get(e.targetLocalId);
    if (!src || !tgt) continue;
    const st = nextNodes.find((n) => n.id === src)?.type;
    const payloadType = st ? getOutputPortType(st) : null;
    const edge = makeFlowEdge(src, tgt, st ?? "imageNode");
    nextEdges.push({
      ...edge,
      sourceHandle: e.sourceHandle ?? "out",
      targetHandle: e.targetHandle ?? "in",
      data:
        e.data ??
        (payloadType
          ? {
              ...(typeof edge.data === "object" && edge.data ? edge.data : {}),
              payloadType,
            }
          : edge.data),
    });
  }
  return { nextNodes, nextEdges };
}

export function loadLocalGroupTemplates(): CanvasGroupTemplateV1[] {
  try {
    const raw = localStorage.getItem(CANVAS_GROUP_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { templates?: CanvasGroupTemplateV1[] };
    return Array.isArray(parsed.templates) ? parsed.templates : [];
  } catch {
    return [];
  }
}

export function saveLocalGroupTemplates(templates: CanvasGroupTemplateV1[]): void {
  localStorage.setItem(
    CANVAS_GROUP_TEMPLATES_STORAGE_KEY,
    JSON.stringify({ version: 1, templates }),
  );
}
