/**
 * 极简音频节点：预览随画布缩放；顶栏/ATP Portal 固定尺寸
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { FlowNodeData } from "@/lib/types";
import { computeAudioNodeFrameSize } from "@/lib/audioNodeFrameSize";
import { isPassiveAudioAsset } from "@/lib/audioNodeContainerMode";
import { useTextNodeFrameResize } from "@/hooks/useTextNodeFrameResize";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { NodeMediaPreview } from "@/components/nodes/NodeMediaPreview";
import { NodeChromeShell, NodeMetaLabel, NodeMetaStatus } from "@/components/nodes/nodeChrome";
import { NodeAnchors } from "./anchors";
import { AudioNodeEmptyUpload } from "./AudioNodeEmptyUpload";
import { AudioPreviewToolbarPortal } from "./AudioPreviewToolbarPortal";
import { AudioTtsPanelPortal } from "./AudioTtsPanelPortal";
import { TextNodeResizeHandle } from "./TextNodeResizeHandle";
import "./AudioNodeChrome.css";
import "./TextNodeChrome.css";

type AudioChromeParams = {
  chromeWidth?: number;
  chromeHeight?: number;
};

interface MinimalAudioNodeProps {
  id: string;
  data: FlowNodeData;
  selected: boolean;
}

export function MinimalAudioNode({ id, data, selected = false }: MinimalAudioNodeProps) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const { expandedChrome } = useNodeExpandedChrome(selected);

  const hasAsset = Boolean(data.path?.trim() || data.assetId?.trim());
  const mediaPath = data.path;
  const mediaAssetId = data.assetId;

  const audioTtsPanelNodeId = useCanvasUiStore((s) => s.audioTtsPanelNodeId);
  const setAudioTtsPanelNodeId = useCanvasUiStore((s) => s.setAudioTtsPanelNodeId);
  const pinnedAtpId = useCanvasUiStore((s) => s.audioTtsPanelPinnedNodeId);
  const setPinnedAtpId = useCanvasUiStore((s) => s.setAudioTtsPanelPinnedNodeId);
  const expandedAtpId = useCanvasUiStore((s) => s.audioTtsPanelExpandedNodeId);
  const setExpandedAtpId = useCanvasUiStore((s) => s.setAudioTtsPanelExpandedNodeId);

  const passiveRef = useMemo(
    () => isPassiveAudioAsset(id, nodes, edges),
    [id, nodes, edges],
  );

  const pinned = pinnedAtpId === id;
  const userOpened = audioTtsPanelNodeId === id;
  const isAtpExpandedModal = expandedAtpId === id;

  const showAtpPortal =
    expandedChrome &&
    !isAtpExpandedModal &&
    (pinned || userOpened || !hasAsset);

  const showPreviewToolbar = expandedChrome && hasAsset;
  const showEmptyUpload = expandedChrome && !hasAsset;

  const params =
    data.params && typeof data.params === "object"
      ? (data.params as AudioChromeParams)
      : {};

  const frameSize = useMemo(
    () =>
      computeAudioNodeFrameSize({
        chromeWidth: params.chromeWidth,
        chromeHeight: params.chromeHeight,
      }),
    [params.chromeHeight, params.chromeWidth],
  );

  const showResizeHandle = expandedChrome && selected;
  const { onResizePointerDown } = useTextNodeFrameResize(id, showResizeHandle);

  const previewRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previewToolbarRef = useRef<HTMLDivElement>(null);

  const label = data.label ?? "";
  const commitLabel = useCallback(
    (next: string | undefined) => updateNodeData(id, { label: next }),
    [id, updateNodeData],
  );

  useEffect(() => {
    if (!selected) {
      if (pinnedAtpId === id) setPinnedAtpId(null);
    }
  }, [id, pinnedAtpId, selected, setPinnedAtpId]);

  const openAtp = useCallback(() => {
    setAudioTtsPanelNodeId(id);
  }, [id, setAudioTtsPanelNodeId]);

  const pinAtp = useCallback(() => {
    setPinnedAtpId(id);
    setAudioTtsPanelNodeId(id);
  }, [id, setAudioTtsPanelNodeId, setPinnedAtpId]);

  const unpinAtp = useCallback(() => {
    if (pinnedAtpId === id) setPinnedAtpId(null);
  }, [id, pinnedAtpId, setPinnedAtpId]);

  const closeAtp = useCallback(() => {
    if (audioTtsPanelNodeId === id) setAudioTtsPanelNodeId(null);
    if (pinnedAtpId === id) setPinnedAtpId(null);
  }, [audioTtsPanelNodeId, id, pinnedAtpId, setAudioTtsPanelNodeId, setPinnedAtpId]);

  useEffect(() => {
    if (!selected) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
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

  return (
    <>
      <NodeMetaLabel label={label} defaultLabel="音频" onCommit={commitLabel} />

      <NodeMetaStatus dimsText={null} generating={isGenerating} progress={genProgress} />

      {showEmptyUpload ? <AudioNodeEmptyUpload nodeId={id} /> : null}

      <NodeChromeShell
        selected={selected}
        width={frameSize.width}
        height={frameSize.height}
        previewRef={previewRef}
        shellClassName="minimal-audio-node"
        previewClassName="minimal-audio-preview"
        afterPreview={<NodeAnchors nodeId={id} nodeType="audioNode" variant="simple" />}
      >
        <div className="minimal-audio-inner">
          {hasAsset ? (
            <>
              {passiveRef ? (
                <span className="minimal-audio-refBadge" title="已作为视频声音参考">
                  参考
                </span>
              ) : null}
              <div className="minimal-audio-content">
                <NodeMediaPreview relPath={mediaPath} assetId={mediaAssetId} kind="audio" />
              </div>
            </>
          ) : (
            <div className="nodeChrome-placeholder minimal-audio-placeholder">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 17V6.5l10-2.2V13"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 17.5a2.5 2.5 0 0 0 5 0v-1.5a2.5 2.5 0 0 0-5 0v1.5Z"
                  fill="currentColor"
                  fillOpacity="0.25"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M15 14.5a2.5 2.5 0 0 0 5 0v-1.5a2.5 2.5 0 0 0-5 0v1.5Z"
                  fill="currentColor"
                  fillOpacity="0.25"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
              <span className="minimal-audio-placeholder-hint">点击上传或拖入音频</span>
            </div>
          )}
          {showResizeHandle ? (
            <TextNodeResizeHandle onResizePointerDown={onResizePointerDown} />
          ) : null}
        </div>
      </NodeChromeShell>

      <AudioPreviewToolbarPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showPreviewToolbar}
        hasLocalAudio={hasAsset}
        onOpenAtp={openAtp}
        toolbarRef={previewToolbarRef}
      />

      <AudioTtsPanelPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showAtpPortal}
        panelWidth={frameSize.width}
        panelRef={panelRef}
        showChromeHead
        onRequestExpand={() => setExpandedAtpId(id)}
        onRequestPin={pinAtp}
        onRequestUnpin={pinned ? unpinAtp : undefined}
        onRequestClose={closeAtp}
      />
    </>
  );
}
