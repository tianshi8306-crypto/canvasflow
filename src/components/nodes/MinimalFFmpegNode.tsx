/**
 * 极简视频合成节点 — 画布入口卡片；剪辑在全屏 ComposeEditorOverlay
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { computeImageNodeFrameSize } from "@/lib/imageGeneration/imageAspectSize";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { normalizeTimelineClips } from "@/lib/compose";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import {
  NodeChromeProvider,
  NodeChromeShell,
  NodeMetaLabel,
  NodeMetaStatus,
  NodePanelPlaceholder,
} from "@/components/nodes/nodeChrome";
import { NodeAnchors } from "./anchors";
import "./MinimalFFmpegNode.css";

const FFMPEG_FRAME_RATIO = 16 / 9;

function _MinimalFFmpegNode({ id, data, selected = false }: NodeProps<Node<FlowNodeData>>) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const { expandedChrome } = useNodeExpandedChrome(selected);

  const timelineClips = normalizeTimelineClips(data);
  const clipCount = timelineClips.length;
  const hasOutput = Boolean(data.path?.trim() || data.assetId?.trim());
  const mediaPath = data.path;
  const mediaAssetId = data.assetId;

  const label = data.label ?? "";
  const commitLabel = useCallback(
    (next: string | undefined) => updateNodeData(id, { label: next }),
    [id, updateNodeData],
  );

  const previewRef = useRef<HTMLDivElement>(null);

  const frameSize = useMemo(
    () => computeImageNodeFrameSize(FFMPEG_FRAME_RATIO),
    [],
  );

  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);

  const openComposeEditor = useCallback(() => {
    useCanvasUiStore.getState().setComposeEditorNodeId(id);
  }, [id]);

  useEffect(() => {
    setVideoSize(null);
  }, [mediaPath, mediaAssetId]);

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const t = e.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        deleteSelection();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selected, deleteSelection]);

  const nodeStatus = data.status;
  const isRunning =
    nodeStatus?.status === "running" &&
    typeof nodeStatus.progress === "number" &&
    Number.isFinite(nodeStatus.progress);
  const runProgress = isRunning ? Math.round(nodeStatus.progress!) : null;

  const dimW = videoSize?.w;
  const dimH = videoSize?.h;
  const showDims = hasOutput && Boolean(dimW && dimH && dimW > 0 && dimH > 0);
  const dimsText = showDims
    ? `${dimW}\u00d7${dimH}`
    : clipCount > 0
      ? `${clipCount} 个片段`
      : null;

  return (
    <NodeChromeProvider>
      <NodeMetaLabel label={label} defaultLabel="剪辑" onCommit={commitLabel} />

      <NodeMetaStatus dimsText={dimsText} generating={isRunning} progress={runProgress} />

      <NodeChromeShell
        selected={selected}
        width={frameSize.width}
        height={frameSize.height}
        previewRef={previewRef}
        shellClassName="minimal-ffmpeg-node"
        previewClassName="minimal-ffmpeg-preview"
        afterPreview={<NodeAnchors nodeId={id} nodeType="ffmpegConcat" variant="simple" />}
      >
        {hasOutput ? (
          <NodeMediaPreview
            relPath={mediaPath}
            assetId={mediaAssetId}
            kind="video"
            onVideoLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth > 0 && v.videoHeight > 0) {
                setVideoSize({ w: v.videoWidth, h: v.videoHeight });
              }
            }}
          />
        ) : (
          <div className="nodeChrome-placeholder minimal-ffmpeg-placeholder">
            <NodePanelPlaceholder kind="ffmpegConcat" />
          </div>
        )}

        {expandedChrome ? (
          <button
            type="button"
            className="minimal-ffmpeg-entry-btn nodrag nopan"
            onClick={(e) => {
              e.stopPropagation();
              openComposeEditor();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            进入剪辑
          </button>
        ) : null}
      </NodeChromeShell>
    </NodeChromeProvider>
  );
}

export const MinimalFFmpegNode = memo(_MinimalFFmpegNode);
