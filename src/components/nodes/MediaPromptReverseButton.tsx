import { useCallback, useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  findDownstreamTextNodeId,
  runMediaPromptReverseToText,
  type MediaPromptReverseKind,
} from "@/lib/mediaPromptReverse";

type Props = {
  sourceNodeId: string;
  mediaKind: MediaPromptReverseKind;
  mediaPath?: string;
  mediaAssetId?: string;
  hasMedia: boolean;
  className?: string;
};

/** 图/视频节点：反推提示词到下游文本（工作流容器写入 prompt） */
export function MediaPromptReverseButton({
  sourceNodeId,
  mediaKind,
  mediaPath,
  mediaAssetId,
  hasMedia,
  className = "imagePreviewToolbarBtn",
}: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const [busy, setBusy] = useState(false);

  const textTargetId = useMemo(
    () => findDownstreamTextNodeId(sourceNodeId, nodes, edges),
    [sourceNodeId, nodes, edges],
  );

  const label = mediaKind === "image" ? "反推提示词" : "反推视频词";

  const handleClick = useCallback(() => {
    if (busy) return;
    if (!textTargetId) {
      setStatusText("请先将本节点连线到下游文本节点");
      return;
    }
    if (!hasMedia) {
      setStatusText(mediaKind === "image" ? "请先有图片再反推" : "请先有视频再反推");
      return;
    }
    setBusy(true);
    void runMediaPromptReverseToText({
      sourceNodeId,
      mediaKind,
      projectPath,
      nodes,
      edges,
      mediaPath,
      mediaAssetId,
      updateNodeData,
      setStatusText,
    }).finally(() => setBusy(false));
  }, [
    busy,
    edges,
    hasMedia,
    mediaAssetId,
    mediaKind,
    mediaPath,
    nodes,
    projectPath,
    setStatusText,
    sourceNodeId,
    textTargetId,
    updateNodeData,
  ]);

  return (
    <button
      type="button"
      className={className}
      disabled={busy || !hasMedia}
      title={
        !textTargetId
          ? "需连接下游文本节点"
          : !hasMedia
            ? mediaKind === "image"
              ? "请先有预览图"
              : "请先有视频"
            : label
      }
      onClick={handleClick}
    >
      {busy ? "反推中…" : label}
    </button>
  );
}
