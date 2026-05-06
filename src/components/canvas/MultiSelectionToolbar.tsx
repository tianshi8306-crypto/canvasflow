import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  /** 右键框选拖拽时抑制工具栏（避免遮挡） */
  marqueeActive: boolean;
};

export function MultiSelectionToolbar({ marqueeActive }: Props) {
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const nodes = useProjectStore((s) => s.nodes);
  const viewport = useProjectStore((s) => s.viewport);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const arrangeSelectedNodes = useProjectStore((s) => s.arrangeSelectedNodes);
  const copySelection = useProjectStore((s) => s.copySelection);
  const pasteSelection = useProjectStore((s) => s.pasteSelection);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const { getNodesBounds, flowToScreenPosition } = useReactFlow();
  const [layoutOpen, setLayoutOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const visible = selectedNodeIds.length >= 2 && !marqueeActive;

  const updatePos = useCallback(() => {
    if (selectedNodeIds.length < 2) {
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
    updatePos();
  }, [updatePos, viewport, selectedNodeIds, nodes]);

  useEffect(() => {
    if (!layoutOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) {
        setLayoutOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [layoutOpen]);

  if (!visible || !pos) return null;

  return (
    <div
      className="multiSelToolbar"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, -100%)",
        zIndex: 45,
      }}
      role="toolbar"
      aria-label="多选操作"
    >
      <div className="multiSelToolbarInner">
        <div className="multiSelLayoutWrap" ref={layoutRef}>
          <button
            type="button"
            className={`multiSelBtn multiSelBtn--icon ${layoutOpen ? "multiSelBtn--active" : ""}`}
            title="排列布局"
            aria-expanded={layoutOpen}
            onClick={() => setLayoutOpen((o) => !o)}
          >
            <span className="multiSelLayoutGlyph" aria-hidden />
          </button>
          {layoutOpen ? (
            <div className="multiSelLayoutMenu" role="menu">
              <button
                type="button"
                className="multiSelMenuItem"
                role="menuitem"
                onClick={() => {
                  arrangeSelectedNodes("grid");
                  setLayoutOpen(false);
                  setStatusText("已宫格排列（等间距、按最大宽高对齐，避免重叠）");
                }}
              >
                <span className="multiSelMenuIcon multiSelMenuIcon--grid" aria-hidden />
                宫格排列
              </button>
              <button
                type="button"
                className="multiSelMenuItem"
                role="menuitem"
                onClick={() => {
                  arrangeSelectedNodes("horizontal");
                  setLayoutOpen(false);
                  setStatusText("已水平排列选中节点");
                }}
              >
                <span className="multiSelMenuIcon multiSelMenuIcon--h" aria-hidden />
                水平排列
              </button>
              <button
                type="button"
                className="multiSelMenuItem"
                role="menuitem"
                onClick={() => {
                  arrangeSelectedNodes("vertical");
                  setLayoutOpen(false);
                  setStatusText("已垂直排列（按节点实际高度 + 统一间距）");
                }}
              >
                <span className="multiSelMenuIcon multiSelMenuIcon--v" aria-hidden />
                垂直排列
              </button>
            </div>
          ) : null}
        </div>
        <span className="multiSelSep" aria-hidden />
        <button
          type="button"
          className="multiSelBtn"
          onClick={() => setStatusText("保存到素材（敬请期待）")}
        >
          <span className="multiSelIconBolt" aria-hidden />
          保存到素材
        </button>
        <button type="button" className="multiSelBtn" onClick={() => setStatusText("批量下载（敬请期待）")}>
          批量下载
        </button>
        <button
          type="button"
          className="multiSelBtn"
          onClick={() => {
            copySelection();
            pasteSelection();
            setStatusText("已创建副本");
          }}
        >
          <span className="multiSelIconDup" aria-hidden />
          创建副本
        </button>
        <span className="multiSelSep" aria-hidden />
        <button
          type="button"
          className="multiSelBtn multiSelBtn--primary"
          onClick={() => {
            groupSelectedNodes();
            setLayoutOpen(false);
          }}
        >
          <span className="multiSelIconFolder" aria-hidden />
          打组
        </button>
      </div>
    </div>
  );
}
