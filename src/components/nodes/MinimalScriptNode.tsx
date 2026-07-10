/**
 * 脚本节点 Chrome：壳内 inline 镜头表预览 + Portal 底栏主题/生成
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import { isTextInputTarget } from "@/lib/canvasInteraction";
import { computeScriptNodeFrameSize } from "@/lib/scriptNodeChrome";
import {
  getScriptGenerationDisplayLabel,
  getScriptGenerationProgressPercent,
} from "@/lib/scriptGenerationProgressDisplay";
import { patchFromScriptBeatsEdit } from "@/lib/storyboardDraftSync";
import { GEN_PANEL_CHROME_WIDTH } from "@/hooks/useNodeGenerationChrome";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { useScriptParseCancel } from "@/hooks/useScriptParseCancel";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import {
  NodeChromeProvider,
  NodeChromeShell,
  NodeMetaLabel,
  NodeMetaStatus,
  NodePanelPlaceholder,
} from "@/components/nodes/nodeChrome";
import { PortalToElement } from "@/components/nodes/nodeChrome/PortalToElement";
import { NodeAnchors } from "@/components/nodes/anchors";
import { VideoGenerationCenterCapsule } from "@/components/nodes/VideoGenerationCenterCapsule";
import { ScriptNodeInlinePreview } from "@/components/nodes/ScriptNodeInlinePreview";
import { ScriptComposerPanelPortal } from "@/components/nodes/ScriptComposerPanelPortal";
import { ScriptPreviewToolbarPortal } from "@/components/nodes/ScriptPreviewToolbarPortal";
import { ScriptNodeReferenceVideoFloat } from "@/components/nodes/ScriptNodeReferenceVideoFloat";
import { incomingVideoUpstreamState } from "@/lib/scriptReferenceVideo";
import { useScriptNodeTaskState } from "@/hooks/useScriptNodeTaskState";
import "./MinimalScriptNode.css";

function MinimalScriptNodeInner({ id, data, selected = false }: NodeProps<Node<FlowNodeData>>) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const projectPath = useProjectStore((s) => s.projectPath);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const setPinnedGenPanelId = useCanvasUiStore((s) => s.setScriptGenPanelPinnedNodeId);
  const pinnedGenPanelId = useCanvasUiStore((s) => s.scriptGenPanelPinnedNodeId);
  const expandedComposerNodeId = useCanvasUiStore((s) => s.scriptGenPanelExpandedNodeId);

  const { expandedChrome } = useNodeExpandedChrome(selected);

  const beats = data.scriptBeats ?? [];
  const beatCount = beats.length;
  const hasBeats = beatCount > 0;

  const dockedBelow = pinnedGenPanelId === id;
  const showComposerPortal =
    expandedChrome && (!hasBeats || dockedBelow) && expandedComposerNodeId !== id;
  const showPreviewToolbar = expandedChrome && hasBeats;
  const videoUpstream = useMemo(
    () => incomingVideoUpstreamState(nodes, edges, id),
    [edges, id, nodes],
  );
  const showUpstreamVideoFloat = expandedChrome && videoUpstream !== "none";

  const previewRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previewToolbarRef = useRef<HTMLDivElement>(null);
  const [previewOverlayEl, setPreviewOverlayEl] = useState<HTMLDivElement | null>(null);
  const cancelParse = useScriptParseCancel(id);

  useEffect(() => {
    if (!selected && pinnedGenPanelId === id) {
      setPinnedGenPanelId(null);
    }
  }, [id, pinnedGenPanelId, selected, setPinnedGenPanelId]);

  const label = data.label ?? "";
  const commitLabel = useCallback(
    (next: string | undefined) => updateNodeData(id, { label: next }),
    [id, updateNodeData],
  );

  const frameSize = useMemo(
    () => computeScriptNodeFrameSize(hasBeats, beatCount),
    [beatCount, hasBeats],
  );

  const { isBusy, status: nodeStatus, isGraphRunning, isStoryboardBusy } =
    useScriptNodeTaskState(id);

  const isGenerating = isBusy;
  const progressInput = useMemo(
    () => ({
      progress: nodeStatus?.progress,
      isGraphRunning,
      isStoryboardBusy,
    }),
    [isGraphRunning, isStoryboardBusy, nodeStatus?.progress],
  );
  const genProgress = isGenerating
    ? (getScriptGenerationProgressPercent(progressInput) ?? null)
    : null;
  const generatingLabel = isGenerating
    ? getScriptGenerationDisplayLabel(progressInput)
    : undefined;

  const dimsText = !isGenerating && hasBeats ? `${beatCount} 镜头` : null;

  const persistBeats = useCallback(
    (next: ScriptBeat[]) => {
      const patch = patchFromScriptBeatsEdit(next, []);
      updateNodeData(id, patch);
    },
    [id, updateNodeData],
  );

  const generationCapsule = isGenerating ? (
    <VideoGenerationCenterCapsule
      label={generatingLabel ?? "正在解析脚本…"}
      onCancel={cancelParse}
      showCancel
    />
  ) : null;

  useEffect(() => {
    if (!selected) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof globalThis.Node)) return;
      const inPanel = panelRef.current?.contains(target);
      const inToolbar = previewToolbarRef.current?.contains(target);
      if (!inPanel && !inToolbar) {
        document.getSelection()?.removeAllRanges();
        (document.activeElement as HTMLElement)?.blur?.();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      const inExpandedComposer =
        expandedComposerNodeId === id &&
        target instanceof Element &&
        Boolean(target.closest(".sgp-expanded-overlay"));
      if (inExpandedComposer) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const inPanel = panelRef.current?.contains(target as globalThis.Node);
      const inToolbar = previewToolbarRef.current?.contains(target as globalThis.Node);
      if (inPanel || inToolbar) return;
      if (isTextInputTarget(target)) return;
      e.preventDefault();
      deleteSelection();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteSelection, expandedComposerNodeId, id, selected]);

  return (
    <NodeChromeProvider>
      <NodeMetaLabel label={label} defaultLabel="分镜脚本" onCommit={commitLabel} />
      <NodeMetaStatus
        dimsText={dimsText}
        generating={isGenerating}
        progress={genProgress}
        generatingLabel={generatingLabel}
      />

      {showUpstreamVideoFloat ? (
        <div className="scriptChrome-floatRow">
          <ScriptNodeReferenceVideoFloat nodeId={id} />
        </div>
      ) : null}

      <NodeChromeShell
        selected={selected}
        width={frameSize.width}
        height={frameSize.height}
        previewRef={previewRef}
        shellClassName="scriptChrome-shell"
        previewClassName="scriptChrome-preview scriptChrome-preview--inlineTable"
        afterPreview={<NodeAnchors nodeId={id} nodeType="scriptNode" variant="simple" />}
      >
        {hasBeats ? (
          <ScriptNodeInlinePreview
            nodeId={id}
            label={label}
            beats={beats}
            projectPath={projectPath}
            readOnly={isGenerating}
            onPersistRows={persistBeats}
            onStatusText={setStatusText}
          />
        ) : (
          <div className="nodeChrome-placeholder scriptChrome-placeholder scriptChrome-emptyShell">
            <NodePanelPlaceholder kind="scriptNode" />
          </div>
        )}
        <div className="nodeChrome-previewGenOverlay" ref={setPreviewOverlayEl} />
      </NodeChromeShell>

      <PortalToElement target={previewOverlayEl}>{generationCapsule}</PortalToElement>

      <ScriptPreviewToolbarPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showPreviewToolbar}
        toolbarRef={previewToolbarRef}
        label={label}
        onCommitLabel={commitLabel}
        dimsText={dimsText}
      />

      <ScriptComposerPanelPortal
        nodeId={id}
        anchorRef={previewRef}
        active={showComposerPortal}
        hideChromeHead={!hasBeats}
        panelWidth={GEN_PANEL_CHROME_WIDTH}
        panelRef={panelRef}
      />
    </NodeChromeProvider>
  );
}

export const MinimalScriptNode = memo(MinimalScriptNodeInner);
