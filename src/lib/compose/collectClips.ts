import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import { getScriptBeatIdFromParams } from "@/lib/incomingScriptBinding";
import { resolveAssetRelPath } from "@/shared/api/assets";

export type ComposeClip = {
  sourceNodeId: string;
  relPath: string;
  scriptBeatId?: string;
  label?: string;
};

const DEFAULT_EXPORT_PATH = "assets/exports/final.mp4";

export { DEFAULT_EXPORT_PATH };

async function resolveVideoOutputRelPath(
  projectPath: string,
  data: FlowNodeData,
  preferOutput?: boolean,
): Promise<string | null> {
  if (preferOutput) {
    const out = data.output?.trim();
    if (out) return out;
  }
  return resolveAssetRelPath(projectPath, data.path, data.assetId);
}

/** 从合成节点的入边收集可拼接片段（含 path / assetId 解析）。 */
export async function collectClipsFromEdges(
  composeNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectPath: string,
): Promise<ComposeClip[]> {
  const clips: ComposeClip[] = [];
  const seenNodes = new Set<string>();

  for (const edge of edges) {
    if (isEdgeDisabled(edge)) continue;
    if (edge.target !== composeNodeId) continue;
    const source = nodes.find((n) => n.id === edge.source);
    if (!source) continue;
    if (source.type !== "videoNode" && source.type !== "ffmpegConcat") continue;
    if (seenNodes.has(source.id)) continue;
    seenNodes.add(source.id);

    const relPath = await resolveVideoOutputRelPath(
      projectPath,
      source.data,
      source.type === "ffmpegConcat",
    );
    if (!relPath) continue;

    clips.push({
      sourceNodeId: source.id,
      relPath,
      scriptBeatId:
        source.type === "videoNode" ? getScriptBeatIdFromParams(source.data) : undefined,
      label: source.data.label?.trim() || undefined,
    });
  }

  return clips;
}

/** 在 scriptBeats 中查找镜头顺序；无脚本绑定时返回 null。 */
export function beatSortIndex(
  nodes: Node<FlowNodeData>[],
  sourceNodeId: string,
  scriptBeatId?: string,
): number | null {
  const beatId =
    scriptBeatId?.trim() ||
    (() => {
      const video = nodes.find((n) => n.id === sourceNodeId);
      return video?.type === "videoNode" ? getScriptBeatIdFromParams(video.data) : undefined;
    })();

  if (beatId) {
    for (const n of nodes) {
      if (n.type !== "scriptNode") continue;
      const beats = n.data.scriptBeats ?? [];
      const idx = beats.findIndex((b) => b.id === beatId);
      if (idx >= 0) return idx;
    }
  }

  for (const n of nodes) {
    if (n.type !== "scriptNode") continue;
    const shots = n.data.storyboardShots ?? [];
    const shot = shots.find((s) => s.videoNodeId === sourceNodeId);
    if (!shot) continue;
    const beats = n.data.scriptBeats ?? [];
    const idx = beats.findIndex((b) => b.id === shot.scriptBeatId);
    if (idx >= 0) return idx;
  }

  return null;
}

/** 按脚本镜号排序；无镜号的片段保持相对顺序并排在后面。 */
export function sortClipsByScriptBeats(
  clips: ComposeClip[],
  nodes: Node<FlowNodeData>[],
): ComposeClip[] {
  return [...clips].sort((a, b) => {
    const ai = beatSortIndex(nodes, a.sourceNodeId, a.scriptBeatId);
    const bi = beatSortIndex(nodes, b.sourceNodeId, b.scriptBeatId);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return 0;
  });
}

/** 从连线收集并可选按脚本排序，返回相对路径列表。 */
export async function collectClipRelPaths(
  composeNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectPath: string,
  opts?: { sortByScript?: boolean },
): Promise<string[]> {
  let clips = await collectClipsFromEdges(composeNodeId, nodes, edges, projectPath);
  if (opts?.sortByScript) {
    clips = sortClipsByScriptBeats(clips, nodes);
  }
  return clips.map((c) => c.relPath);
}
