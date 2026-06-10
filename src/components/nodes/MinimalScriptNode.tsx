/**
 * 脚本节点 Chrome：壳内迷你表预览 + Portal 底栏主题/生成
 */
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { computeScriptNodeFrameSize } from "@/lib/scriptNodeChrome";
import { GEN_PANEL_CHROME_WIDTH } from "@/hooks/useNodeGenerationChrome";
import { useNodeExpandedChrome } from "@/hooks/useNodeExpandedChrome";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import {
  NodeChromeProvider,
  NodeChromeShell,
  NodeMetaLabel,
  NodeMetaStatus,
  NodePanelPlaceholder,
} from "@/components/nodes/nodeChrome";
import { NodeAnchors } from "@/components/nodes/anchors";
import { ScriptNodeMiniPreview } from "@/components/nodes/ScriptNodeMiniPreview";
import { ScriptComposerPanelPortal } from "@/components/nodes/ScriptComposerPanelPortal";
import { ScriptPreviewToolbarPortal } from "@/components/nodes/ScriptPreviewToolbarPortal";
import { ScriptNodeReferenceVideoFloat } from "@/components/nodes/ScriptNodeReferenceVideoFloat";
import { incomingVideoUpstreamState } from "@/lib/scriptReferenceVideo";
import { useScriptNodeTaskState } from "@/hooks/useScriptNodeTaskState";
import "./MinimalScriptNode.css";

function _MinimalScriptNode({ id, data, selected = false }: NodeProps<Node<FlowNodeData>>) {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const setPinnedGenPanelId = useCanvasUiStore((s) => s.setScriptGenPanelPinnedNodeId);
  const pinnedGenPanelId = useCanvasUiStore((s) => s.scriptGenPanelPinnedNodeId);
  const expandedComposerNodeId = useCanvasUiStore((s) => s.scriptGenPanelExpandedNodeId);

  const { expandedChrome } = useNodeExpandedChrome(selected);

  const beats = data.scriptBeats ?? [];
  const beatCount = beats.length;
  const hasBeats = beatCount > 0;
  const themePrompt = data.prompt ?? "";

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

  const { isBusy, status: nodeStatus } = useScriptNodeTaskState(id);

  const isGenerating = isBusy;
  const genProgress =
    isGenerating &&
    typeof nodeStatus?.progress === "number" &&
    Number.isFinite(nodeStatus.progress)
      ? Math.round(nodeStatus.progress)
      : null;

  const dimsText = !isGenerating && hasBeats ? `${beatCount} 镜头` : null;

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
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if ((t as HTMLElement).isContentEditable) return;
      // 仅当焦点在脚本节点的 Portal 面板内时才拦截删除（只删当前节点）
      const inPanel = panelRef.current?.contains(t as globalThis.Node);
      const inToolbar = previewToolbarRef.current?.contains(t as globalThis.Node);
      if (!inPanel && !inToolbar) return;
      e.preventDefault();
      // 只删除当前脚本节点，不波及画布上其他选区
      useProjectStore.setState((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        selectedNodeIds: s.selectedNodeIds.filter((nid) => nid !== id),
        selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
        projectDirty: true,
      }));
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [id, selected]);

  return (
    <NodeChromeProvider>
      <NodeMetaLabel label={label} defaultLabel="分镜脚本" onCommit={commitLabel} />
      <NodeMetaStatus dimsText={dimsText} generating={isGenerating} progress={genProgress} />

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
        previewClassName="scriptChrome-preview"
        afterPreview={<NodeAnchors nodeId={id} nodeType="scriptNode" variant="simple" />}
      >
        {hasBeats ? (
          <ScriptNodeMiniPreview
            beats={beats}
            themePrompt={themePrompt}
            generating={isGenerating}
            progress={genProgress}
          />
        ) : (
          <div className="nodeChrome-placeholder scriptChrome-placeholder scriptChrome-emptyShell">
            <NodePanelPlaceholder kind="scriptNode" />
          </div>
        )}
      </NodeChromeShell>

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

export const MinimalScriptNode = memo(_MinimalScriptNode);
