import { useCallback, useLayoutEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { CANVAS_Z } from "@/components/canvas/menuConstants";
import { hasGroupInSelection } from "@/lib/canvasGroup";
import type { AlignOp, DistributeOp } from "@/lib/nodeAlignCommands";

type Props = {
  /** 右键框选拖拽时抑制工具栏（避免遮挡） */
  marqueeActive: boolean;
};

function IconAlignLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path d="M5 5v14M9 7h10M9 12h7M9 17h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconAlignH() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path d="M5 12h14M9 7h6M9 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconAlignTop() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path d="M5 5h14M7 9v10M12 9v7M17 9v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconDistributeH() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path d="M6 7v10M18 7v10M9 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconDuplicate() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconGroup() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path
        d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconWorkflow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path
        d="M5 7h5l2 3h7M5 17h6l2-3h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="7" r="1.5" fill="currentColor" />
      <circle cx="19" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function MultiSelectionToolbar({ marqueeActive }: Props) {
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const nodes = useProjectStore((s) => s.nodes);
  const viewport = useProjectStore((s) => s.viewport);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const arrangeSelectedNodes = useProjectStore((s) => s.arrangeSelectedNodes);
  const alignSelectedNodes = useProjectStore((s) => s.alignSelectedNodes);
  const distributeSelectedNodes = useProjectStore((s) => s.distributeSelectedNodes);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const openSaveWorkflowDialog = useCanvasUiStore((s) => s.openSaveWorkflowDialog);
  const gridCols = useCanvasUiStore((s) => s.multiSelectGridCols);
  const setGridCols = useCanvasUiStore((s) => s.setMultiSelectGridCols);

  const { getNodesBounds, flowToScreenPosition } = useReactFlow();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const topLevelCount = selectedNodeIds.filter((id) => {
    const n = nodes.find((nn) => nn.id === id);
    return n && !n.parentId;
  }).length;
  const effectiveGridCols = Math.max(2, Math.min(gridCols, Math.max(2, topLevelCount))) as 2 | 3 | 4;

  const visible =
    selectedNodeIds.length >= 2 && !marqueeActive && !hasGroupInSelection(nodes, selectedNodeIds);

  const updatePos = useCallback(() => {
    if (selectedNodeIds.length < 2) {
      setPos(null);
      return;
    }
    try {
      const b = getNodesBounds(selectedNodeIds);
      const cx = b.x + b.width / 2;
      const top = flowToScreenPosition({ x: cx, y: b.y });
      setPos({ left: top.x, top: top.y - 14 });
    } catch {
      setPos(null);
    }
  }, [flowToScreenPosition, getNodesBounds, selectedNodeIds]);

  useLayoutEffect(() => {
    updatePos();
  }, [updatePos, viewport, selectedNodeIds, nodes]);

  if (!visible || !pos) return null;

  const canDistribute = topLevelCount >= 3;

  const align = (op: AlignOp) => () => alignSelectedNodes(op);
  const distribute = (op: DistributeOp) => () => distributeSelectedNodes(op);

  return (
    <div
      className="multiSelToolbar"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, -100%)",
        zIndex: CANVAS_Z.toolbar,
      }}
      role="toolbar"
      aria-label="多选操作"
    >
      <div className="multiSelToolbarInner multiSelToolbarInner--wide">
        <button type="button" className="multiSelBtn multiSelBtn--compact" title="左对齐" onClick={align("left")}>
          <IconAlignLeft />
        </button>
        <button
          type="button"
          className="multiSelBtn multiSelBtn--compact multiSelBtn--flipX"
          title="右对齐"
          onClick={align("right")}
        >
          <IconAlignLeft />
        </button>
        <button type="button" className="multiSelBtn multiSelBtn--compact" title="顶对齐" onClick={align("top")}>
          <IconAlignTop />
        </button>
        <button
          type="button"
          className="multiSelBtn multiSelBtn--compact multiSelBtn--flipY"
          title="底对齐"
          onClick={align("bottom")}
        >
          <IconAlignTop />
        </button>
        <button type="button" className="multiSelBtn multiSelBtn--compact" title="水平居中" onClick={align("centerH")}>
          <IconAlignH />
        </button>
        <button
          type="button"
          className="multiSelBtn multiSelBtn--compact multiSelBtn--rotate90"
          title="垂直居中"
          onClick={align("centerV")}
        >
          <IconAlignH />
        </button>

        <span className="multiSelSep" aria-hidden />

        <button
          type="button"
          className="multiSelBtn multiSelBtn--compact"
          title={canDistribute ? "水平等距分布" : "至少选中 3 个未嵌套节点"}
          disabled={!canDistribute}
          onClick={distribute("horizontal")}
        >
          <IconDistributeH />
        </button>
        <button
          type="button"
          className="multiSelBtn multiSelBtn--compact multiSelBtn--rotate90"
          title={canDistribute ? "垂直等距分布" : "至少选中 3 个未嵌套节点"}
          disabled={!canDistribute}
          onClick={distribute("vertical")}
        >
          <IconDistributeH />
        </button>

        <span className="multiSelSep" aria-hidden />

        <button
          type="button"
          className="multiSelBtn"
          title={`等间距宫格排列（设定${gridCols}列，当前按${effectiveGridCols}列）`}
          onClick={() => arrangeSelectedNodes("grid", { gridCols: effectiveGridCols })}
        >
          <IconGrid />
          宫格{effectiveGridCols}列
        </button>
        <div className="multiSelGridCols" role="group" aria-label="宫格列数">
          {[2, 3, 4].map((col) => (
            <button
              key={col}
              type="button"
              className={`multiSelGridColsBtn${gridCols === col ? " is-active" : ""}`}
              title={`设为 ${col} 列宫格`}
              onClick={() => setGridCols(col as 2 | 3 | 4)}
            >
              {col}列
            </button>
          ))}
        </div>

        <span className="multiSelSep" aria-hidden />

        <button type="button" className="multiSelBtn" title="复制并粘贴偏移副本" onClick={() => {
          copySelection();
          pasteSelection();
        }}>
          <IconDuplicate />
          副本
        </button>

        <button
          type="button"
          className="multiSelBtn"
          title="保存到本机 / 工程工作流库"
          onClick={() => openSaveWorkflowDialog()}
        >
          <IconWorkflow />
          存工作流
        </button>

        <button
          type="button"
          className="multiSelBtn multiSelBtn--accent"
          title="将选中节点打组（Ctrl+G）"
          onClick={() => groupSelectedNodes()}
        >
          <IconGroup />
          打组
        </button>
      </div>
    </div>
  );
}
