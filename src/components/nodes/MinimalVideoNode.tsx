/**

 * 极简视频节点 - Chrome 模式（对齐 MinimalImageNode）

 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type NodeProps, type Node } from "@xyflow/react";

import type { FlowNodeData } from "@/lib/types";

import {
  computeVideoNodeFrameSize,
  resolveVideoNodeFrameRatio,
} from "@/lib/videoGeneration/videoAspectSize";

import { defaultVideoGenerationDraft, defaultVideoNodePersisted } from "@/lib/videoNodeTypes";
import {
  getVideoGenerationDisplayLabel,
  getVideoGenerationProgressPercent,
  isVideoGenerationInProgress,
} from "@/lib/video/videoGenerationProgressDisplay";

import type { TextToVideoAspectId } from "@/lib/videoNodeTypes";

import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";

import { useCanvasUiStore } from "@/store/canvasUiStore";

import { useProjectStore } from "@/store/projectStore";

import { VideoChromePreview } from "@/components/nodes/VideoChromePreview";

import {
  NodeChromeProvider,
  NodeChromeShell,
  NodeMetaLabel,
  NodeMetaStatus,
  NodePanelPlaceholder,
} from "@/components/nodes/nodeChrome";

import { NodeAnchors } from "./anchors";

import { VideoGenerationPanelPortal } from "./VideoGenerationPanelPortal";

import { VideoNodeEmptyUpload } from "./VideoNodeEmptyUpload";

import { VideoPreviewToolbarPortal } from "./VideoPreviewToolbarPortal";

import "./MinimalVideoNode.css";

export function MinimalVideoNode({
  id,

  data,

  selected = false,
}: NodeProps<Node<FlowNodeData>>) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  const deleteSelection = useProjectStore((s) => s.deleteSelection);

  const { expandedChrome } = useNodeExpandedChrome(selected);

  const expandedGenPanelId = useCanvasUiStore((s) => s.videoGenPanelExpandedNodeId);

  const videoTrimEditingNodeId = useCanvasUiStore((s) => s.videoTrimEditingNodeId);
  const setVideoTrimEditingNodeId = useCanvasUiStore((s) => s.setVideoTrimEditingNodeId);
  const videoSubtitleRegionEditingNodeId = useCanvasUiStore(
    (s) => s.videoSubtitleRegionEditingNodeId,
  );
  const setVideoSubtitleRegionEditingNodeId = useCanvasUiStore(
    (s) => s.setVideoSubtitleRegionEditingNodeId,
  );

  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());

  const mediaPath = data.path;

  const mediaAssetId = data.assetId;

  const videoBlock = data.video ?? defaultVideoNodePersisted();

  const draft = videoBlock.draft ?? defaultVideoGenerationDraft();

  const showGenPanel = expandedChrome && expandedGenPanelId !== id;

  const showPreviewToolbar = expandedChrome && hasPath;

  const showEmptyUpload = expandedChrome && !hasPath;

  useEffect(() => {
    if (!selected) {
      if (videoTrimEditingNodeId === id) setVideoTrimEditingNodeId(null);
      if (videoSubtitleRegionEditingNodeId === id) setVideoSubtitleRegionEditingNodeId(null);
    }
  }, [
    id,
    selected,
    setVideoTrimEditingNodeId,
    setVideoSubtitleRegionEditingNodeId,
    videoSubtitleRegionEditingNodeId,
    videoTrimEditingNodeId,
  ]);

  const label = data.label ?? "";

  const commitLabel = useCallback(
    (next: string | undefined) => updateNodeData(id, { label: next }),

    [id, updateNodeData],
  );

  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);
  const [previewOverlayEl, setPreviewOverlayEl] = useState<HTMLDivElement | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const previewToolbarRef = useRef<HTMLDivElement>(null);

  const handleVideoMeta = useCallback((size: { w: number; h: number }) => {
    if (size.w > 0 && size.h > 0) setVideoSize(size);
  }, []);

  const aspectId = (draft.output?.aspectRatio ?? "16:9") as TextToVideoAspectId;

  const frameRatio = useMemo(
    () =>
      resolveVideoNodeFrameRatio({
        aspectId,

        videoWidth: videoSize?.w,

        videoHeight: videoSize?.h,
      }),

    [aspectId, videoSize],
  );

  const frameSize = useMemo(() => computeVideoNodeFrameSize(frameRatio), [frameRatio]);

  useEffect(() => {
    setVideoSize(null);
  }, [mediaPath, mediaAssetId]);

  useEffect(() => {
    if (!selected) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target;

      if (!(target instanceof Element)) return;

      const inPanel = panelRef.current?.contains(target);

      const inToolbar = previewToolbarRef.current?.contains(target);

      if (!inPanel && !inToolbar) {
        document.getSelection()?.removeAllRanges();

        (document.activeElement as HTMLElement)?.blur?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.getSelection()?.removeAllRanges();

        (document.activeElement as HTMLElement)?.blur?.();
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const t = e.target;

        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;

        e.preventDefault();

        deleteSelection();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);

      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selected, deleteSelection]);

  const jobStatus = videoBlock.activeJob?.status;
  const isGenerating = isVideoGenerationInProgress({ status: jobStatus });
  const genProgressPercent = isGenerating
    ? getVideoGenerationProgressPercent({
        status: jobStatus,
        progress: videoBlock.activeJob?.progress,
      })
    : undefined;
  const generatingLabel = isGenerating
    ? getVideoGenerationDisplayLabel({
        status: jobStatus,
        progress: videoBlock.activeJob?.progress,
      })
    : undefined;

  const dimW = videoSize?.w;

  const dimH = videoSize?.h;

  const showDims = hasPath && Boolean(dimW && dimH && dimW > 0 && dimH > 0);

  const dimsText = showDims ? `${dimW}\u00d7${dimH}` : null;

  return (
    <NodeChromeProvider>
      <NodeMetaLabel label={label} defaultLabel="视频" onCommit={commitLabel} />

      {(hasPath || isGenerating) ? (
        <NodeMetaStatus
          dimsText={dimsText}
          generating={isGenerating}
          progress={genProgressPercent}
          generatingLabel={generatingLabel}
        />
      ) : null}

      {showEmptyUpload ? <VideoNodeEmptyUpload nodeId={id} /> : null}

      <NodeChromeShell
        selected={selected}
        width={frameSize.width}
        height={frameSize.height}
        previewRef={previewRef}
        previewClassName="minimal-video-preview"
        afterPreview={<NodeAnchors nodeId={id} nodeType="videoNode" variant="simple" />}
      >
        {hasPath ? (
          <VideoChromePreview
            nodeId={id}
            relPath={mediaPath}
            assetId={mediaAssetId}
            onVideoMeta={handleVideoMeta}
          />
        ) : (
          <div className="nodeChrome-placeholder minimal-video-placeholder" aria-hidden>
            <NodePanelPlaceholder kind="videoNode" />
          </div>
        )}
        <div className="nodeChrome-previewGenOverlay" ref={setPreviewOverlayEl} />
      </NodeChromeShell>

      <VideoPreviewToolbarPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showPreviewToolbar}
        toolbarRef={previewToolbarRef}
      />

      <VideoGenerationPanelPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showGenPanel}
        panelRef={panelRef}
        previewOverlayEl={previewOverlayEl}
      />
    </NodeChromeProvider>
  );
}
