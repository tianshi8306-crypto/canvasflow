import type { Node } from "@xyflow/react";
import { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import type { FlowNodeData } from "@/lib/types";
import { findImageNodesForScript } from "@/lib/storyboard/storyboardMediaNodes";

export type HermesCreativeStageId =
  | "ideation"
  | "outline"
  | "visualization"
  | "adjustment"
  | "finishing";

export type HermesCreativeStage = {
  id: HermesCreativeStageId;
  label: string;
  hint: string;
};

const STAGES: Record<HermesCreativeStageId, Omit<HermesCreativeStage, "id">> = {
  ideation: { label: "创意碰撞", hint: "聊想法、定方向，或上传参考图" },
  outline: { label: "大纲", hint: "写梗概与镜头表" },
  visualization: { label: "视觉化", hint: "分镜文案与关键帧出图" },
  adjustment: { label: "调整", hint: "改镜、重出、对照参考素材" },
  finishing: { label: "成片", hint: "剪辑合成与导出" },
};

export function inferHermesCreativeStage(
  nodes: Node<FlowNodeData>[],
  edges: { source: string; target: string }[],
  projectPath: string | null,
): HermesCreativeStage {
  const ctx = buildHermesCanvasContext(nodes, projectPath);
  let id: HermesCreativeStageId = "ideation";

  if (!ctx.scriptNodeId) {
    id = "ideation";
  } else if (ctx.beatCount === 0) {
    id = "outline";
  } else if (ctx.storyboardReadyCount === 0) {
    id = "outline";
  } else if (ctx.scriptNodeId) {
    const images = findImageNodesForScript(ctx.scriptNodeId, nodes, edges);
    const hasPath = [...images.values()].some((imageNodeId) => {
      const n = nodes.find((x) => x.id === imageNodeId);
      return Boolean(n?.data.path?.trim() || n?.data.assetId?.trim());
    });
    const videos = nodes.filter(
      (n) =>
        n.type === "videoNode" &&
        (n.data.path?.trim() || (n.data.video as { path?: string } | undefined)?.path),
    );
    if (videos.length > 0) id = "finishing";
    else if (hasPath) id = "adjustment";
    else id = "visualization";
  }

  const meta = STAGES[id];
  return { id, ...meta };
}
