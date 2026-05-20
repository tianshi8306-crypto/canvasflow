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

import type { TextToVideoAspectId } from "@/lib/videoNodeTypes";

import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";

import { useCanvasUiStore } from "@/store/canvasUiStore";

import { useProjectStore } from "@/store/projectStore";

import { VideoChromePreview } from "@/components/nodes/VideoChromePreview";

import { NodeChromeShell, NodeMetaLabel, NodeMetaStatus } from "@/components/nodes/nodeChrome";

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

  const pinnedGenPanelId = useCanvasUiStore((s) => s.videoGenPanelPinnedNodeId);

  const setPinnedGenPanelId = useCanvasUiStore((s) => s.setVideoGenPanelPinnedNodeId);
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

  const [genPanelPinned, setGenPanelPinned] = useState(false);

  const dockedBelow = genPanelPinned || pinnedGenPanelId === id;

  const showGenPanel = expandedChrome && (!hasPath || dockedBelow) && expandedGenPanelId !== id;

  const showPreviewToolbar = expandedChrome && hasPath;

  const showEmptyUpload = expandedChrome && !hasPath;

  useEffect(() => {
    if (!selected) {
      setGenPanelPinned(false);

      if (pinnedGenPanelId === id) setPinnedGenPanelId(null);
      if (videoTrimEditingNodeId === id) setVideoTrimEditingNodeId(null);
      if (videoSubtitleRegionEditingNodeId === id) setVideoSubtitleRegionEditingNodeId(null);
    }
  }, [
    id,
    pinnedGenPanelId,
    selected,
    setPinnedGenPanelId,
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

  const nodeStatus = data.status;

  const isGenerating =
    nodeStatus?.status === "running" &&
    typeof nodeStatus.progress === "number" &&
    Number.isFinite(nodeStatus.progress);

  const genProgress = isGenerating ? Math.round(nodeStatus.progress!) : null;

  const dimW = videoSize?.w;

  const dimH = videoSize?.h;

  const showDims = hasPath && Boolean(dimW && dimH && dimW > 0 && dimH > 0);

  const dimsText = showDims ? `${dimW}\u00d7${dimH}` : null;

  return (
    <>
      <NodeMetaLabel label={label} defaultLabel="视频" onCommit={commitLabel} />

      {hasPath ? (
        <NodeMetaStatus dimsText={dimsText} generating={isGenerating} progress={genProgress} />
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
            <svg viewBox="0 0 24 24" fill="#616161" aria-hidden>
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 2.5v-7l-4 2.5z" />
            </svg>
          </div>
        )}
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
      />
    </>
  );
}
