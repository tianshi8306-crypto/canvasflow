/**
 * 极简音频节点：预览随画布缩放；顶栏/ATP Portal 固定尺寸
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlowNodeData } from "@/lib/types";
import { computeAudioNodeFrameSize } from "@/lib/audioNodeFrameSize";
import { isPassiveAudioAsset } from "@/lib/audioNodeContainerMode";
import { GEN_PANEL_CHROME_WIDTH } from "@/hooks/useNodeGenerationChrome";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { MinimalAudioWavePlayer } from "@/components/nodes/MinimalAudioWavePlayer";
import {
  NodeChromeProvider,
  NodeChromeShell,
  NodeMetaLabel,
  NodeMetaStatus,
  NodePanelPlaceholder,
} from "@/components/nodes/nodeChrome";
import { NodeAnchors } from "./anchors";
import { AudioNodeEmptyUpload } from "./AudioNodeEmptyUpload";
import { AudioPreviewToolbarPortal } from "./AudioPreviewToolbarPortal";
import { AudioTtsPanelPortal } from "./AudioTtsPanelPortal";
import "./AudioNodeChrome.css";

interface MinimalAudioNodeProps {
  id: string;
  data: FlowNodeData;
  selected: boolean;
}

function _MinimalAudioNode({ id, data, selected = false }: MinimalAudioNodeProps) {
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
    expandedChrome && !isAtpExpandedModal && (pinned || userOpened);

  const showPreviewToolbar = expandedChrome && hasAsset;
  const showEmptyUpload = expandedChrome && !hasAsset;

  const frameSize = computeAudioNodeFrameSize();

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

  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (!selected || !expandedChrome || hasAsset || isAtpExpandedModal) return;
    if (audioTtsPanelNodeId === id) return;
    setAudioTtsPanelNodeId(id);
  }, [
    audioTtsPanelNodeId,
    expandedChrome,
    hasAsset,
    id,
    isAtpExpandedModal,
    selected,
    setAudioTtsPanelNodeId,
  ]);

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
    <NodeChromeProvider>
      {!showPreviewToolbar ? (
        <>
          <NodeMetaLabel label={label} defaultLabel="音频" onCommit={commitLabel} />
          <NodeMetaStatus dimsText={null} generating={isGenerating} progress={genProgress} />
        </>
      ) : null}

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
                <MinimalAudioWavePlayer
                  nodeId={id}
                  relPath={mediaPath}
                  assetId={mediaAssetId}
                  playbackRate={playbackRate}
                  showReplace={expandedChrome}
                />
              </div>
            </>
          ) : (
            <div className="nodeChrome-placeholder minimal-audio-placeholder" aria-hidden>
              <NodePanelPlaceholder kind="audioNode" />
            </div>
          )}
        </div>
      </NodeChromeShell>

      <AudioPreviewToolbarPortal
        anchorRef={previewRef}
        active={showPreviewToolbar}
        hasLocalAudio={hasAsset}
        mediaPath={mediaPath}
        mediaAssetId={mediaAssetId}
        playbackRate={playbackRate}
        onPlaybackRateChange={setPlaybackRate}
        toolbarRef={previewToolbarRef}
        label={label}
        onCommitLabel={commitLabel}
        generating={isGenerating}
        progress={genProgress}
      />

      <AudioTtsPanelPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showAtpPortal}
        panelWidth={GEN_PANEL_CHROME_WIDTH}
        panelRef={panelRef}
        onRequestExpand={() => setExpandedAtpId(id)}
      />
    </NodeChromeProvider>
  );
}

export const MinimalAudioNode = memo(_MinimalAudioNode);
