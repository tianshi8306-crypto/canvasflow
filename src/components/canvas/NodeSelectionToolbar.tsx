import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { getUndoRedoAvailability } from "@/store/projectStore";

export function NodeSelectionToolbar() {
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const nodes = useProjectStore((s) => s.nodes);
  const viewport = useProjectStore((s) => s.viewport);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const setSelectedNodeIds = useProjectStore((s) => s.setSelectedNodeIds);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);
  const setSelectedEdgeIds = useProjectStore((s) => s.setSelectedEdgeIds);
  const flowClipboardCount = useProjectStore((s) => s.flowClipboardCount);
  const { getNodesBounds, flowToScreenPosition } = useReactFlow();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 单节点选中时显示
  const visible = selectedNodeIds.length === 1;

  // 判断是否是图片节点
  const selectedNode = visible ? nodes.find((n) => n.id === selectedNodeIds[0]) : null;
  const usesNodeChrome =
    selectedNode?.type === "imageNode" ||
    selectedNode?.type === "videoNode" ||
    selectedNode?.type === "textNode" ||
    selectedNode?.type === "audioNode";

  const updatePos = useCallback(() => {
    if (selectedNodeIds.length !== 1) {
      setPos(null);
      return;
    }
    try {
      const b = getNodesBounds(selectedNodeIds);
      const cx = b.x + b.width / 2;
      const top = flowToScreenPosition({ x: cx, y: b.y });
      setPos({ left: top.x, top: top.y - 12 });
    } catch {
      setPos(null);
    }
  }, [flowToScreenPosition, getNodesBounds, selectedNodeIds]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updatePos();
  }, [updatePos, viewport, selectedNodeIds, nodes]);

  // 键盘快捷键
  useLayoutEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, deleteSelection]);

  if (!visible || !pos) return null;

  // 图片/视频节点：自有 Chrome 顶底栏
  if (usesNodeChrome) return null;

  const { canUndo, canRedo } = getUndoRedoAvailability();
  const canCopy = selectedNodeIds.length > 0;
  const canPaste = flowClipboardCount > 0;
  const canDelete = selectedNodeIds.length > 0;

  const handleCopy = () => {
    copySelection();
  };

  const handlePaste = () => {
    pasteSelection();
  };

  const handleDelete = () => {
    deleteSelection();
    setSelectedNodeIds([]);
    setSelectedNodeId(null);
    setSelectedEdgeIds([]);
  };

  return (
    <div
      className="nodeSelToolbar"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, -100%)",
        zIndex: 45,
      }}
      role="toolbar"
      aria-label="节点操作"
    >
      <div className="nodeSelToolbarInner" ref={wrapRef}>
        {/* 撤销 */}
        <button
          type="button"
          className="nodeSelBtn"
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
          aria-label="撤销"
          onClick={undo}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 14 4 9l5-5M5 9h11a4 4 0 0 1 4 4v1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {/* 重做 */}
        <button
          type="button"
          className="nodeSelBtn"
          disabled={!canRedo}
          title="重做 (Ctrl+Y)"
          aria-label="重做"
          onClick={redo}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 14l5-5-5-5M15 9h-11a4 4 0 0 0-4 4v1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <span className="nodeSelSep" aria-hidden />

        {/* 复制 */}
        <button
          type="button"
          className="nodeSelBtn"
          disabled={!canCopy}
          title="复制 (Ctrl+C)"
          aria-label="复制"
          onClick={handleCopy}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
        {/* 粘贴 */}
        <button
          type="button"
          className="nodeSelBtn"
          disabled={!canPaste}
          title="粘贴 (Ctrl+V)"
          aria-label="粘贴"
          onClick={handlePaste}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        <span className="nodeSelSep" aria-hidden />

        {/* 删除 */}
        <button
          type="button"
          className="nodeSelBtn nodeSelBtn--danger"
          disabled={!canDelete}
          title="删除 (Delete)"
          aria-label="删除"
          onClick={handleDelete}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

      </div>
    </div>
  );
}
