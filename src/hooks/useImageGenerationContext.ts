import { useEffect, useMemo, useState } from "react";
import { getImageEditIntent } from "@/lib/imageGeneration/imageEditIntent";
import {
  resolveImageGenerationContext,
  type ImageGenerationContext,
} from "@/lib/imageGeneration";
import { useProjectStore } from "@/store/projectStore";

const EMPTY: ImageGenerationContext = {
  incomingImageRefs: [],
  resolvedRefs: [],
  aggregatedPrompt: "",
  task: null,
  referenceImagePaths: [],
  blockReason: null,
  warnMessage: null,
};

/**
 * 订阅画布拓扑并解析图片节点生成上下文（与生成按钮、只读 task 状态共用）。
 */
export function useImageGenerationContext(
  nodeId: string,
  /** 本地 prompt 变更时触发重算（与 node.data.prompt 同步） */
  promptRevision: string,
): ImageGenerationContext {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const [ctx, setCtx] = useState<ImageGenerationContext>(EMPTY);

  const editIntentKey = useMemo(() => {
    const n = nodes.find((x) => x.id === nodeId);
    return JSON.stringify(getImageEditIntent(n?.data));
  }, [nodes, nodeId]);

  useEffect(() => {
    let cancelled = false;
    void resolveImageGenerationContext(nodes, edges, nodeId, projectPath).then((next) => {
      if (!cancelled) setCtx(next);
    });
    return () => {
      cancelled = true;
    };
  }, [nodes, edges, nodeId, projectPath, promptRevision, editIntentKey]);

  return ctx;
}
