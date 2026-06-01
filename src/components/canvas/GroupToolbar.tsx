import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { evaluateGroupHermesImages } from "@/lib/hermes/groupHermesImages";
import { useReactFlow } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { CANVAS_Z } from "@/components/canvas/menuConstants";
import { groupBoundsNodeIds, isSingleGroupSelection } from "@/lib/canvasGroup";
import {
  GROUP_COLOR_GRID,
  GROUP_COLOR_OPTIONS,
  normalizeGroupColorToken,
  resolveGroupColorToken,
  type GroupColorToken,
} from "@/lib/canvasGroupColors";
import {
  evaluateConvertGroupToStoryboard,
  isStoryboardGroup,
} from "@/lib/canvasGroupStoryboard";

type Props = {
  marqueeActive: boolean;
};

type PopoverKind = "color" | "arrange" | null;

const COLOR_BY_ID = new Map(GROUP_COLOR_OPTIONS.map((c) => [c.id, c]));

function IconLayoutH() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLayoutV() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path d="M7 4v16M12 4v16M17 4v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function IconHermes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path
        d="M13 3L5 14h6l-1 7 8-12h-6l1-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path
        d="M8 6.5v11l9-5.5-9-5.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconToolbox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconStoryboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUngroup() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path
        d="M4 10h16M4 14h16M10 4v16M14 4v16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="multiSelBtnIcon">
      <path
        d="M12 4v10M8 11l4 4 4-4M5 20h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconColorNone() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 18L18 6" stroke="#f87171" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function GroupToolbar({ marqueeActive }: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const viewport = useProjectStore((s) => s.viewport);
  const arrangeGroupMembers = useProjectStore((s) => s.arrangeGroupMembers);
  const ungroupSelectedNodes = useProjectStore((s) => s.ungroupSelectedNodes);
  const runGroupSubgraph = useProjectStore((s) => s.runGroupSubgraph);
  const runGroupHermesImages = useProjectStore((s) => s.runGroupHermesImages);
  const exportGroupMedia = useProjectStore((s) => s.exportGroupMedia);
  const duplicateGroup = useProjectStore((s) => s.duplicateGroup);
  const convertGroupToStoryboard = useProjectStore((s) => s.convertGroupToStoryboard);
  const setGroupColorToken = useProjectStore((s) => s.setGroupColorToken);
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);
  const setStatusText = useProjectStore((s) => s.setStatusText);

  const { getNodesBounds, flowToScreenPosition } = useReactFlow();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [openPopover, setOpenPopover] = useState<PopoverKind>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const groupId = isSingleGroupSelection(nodes, selectedNodeIds) ? selectedNodeIds[0]! : null;
  const visible = Boolean(groupId) && !marqueeActive;

  const updatePos = useCallback(() => {
    if (!groupId) {
      setPos(null);
      return;
    }
    try {
      const b = getNodesBounds(groupBoundsNodeIds(nodes, groupId));
      const cx = b.x + b.width / 2;
      const top = flowToScreenPosition({ x: cx, y: b.y });
      setPos({ left: top.x, top: top.y - 14 });
    } catch {
      setPos(null);
    }
  }, [flowToScreenPosition, getNodesBounds, groupId, nodes]);

  useLayoutEffect(() => {
     
    updatePos();
  }, [updatePos, viewport, selectedNodeIds, nodes]);

  useEffect(() => {
    if (!openPopover) return;
    const onPointerDown = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      setOpenPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPopover(null);
    };
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [openPopover]);

  useEffect(() => {
    setOpenPopover(null);
  }, [groupId]);

  const groupNode = groupId ? nodes.find((n) => n.id === groupId) : undefined;
  const storyboard = isStoryboardGroup(groupNode);
  const convertVerdict = useMemo(
    () =>
      groupId
        ? evaluateConvertGroupToStoryboard(nodes, edges, groupId)
        : ({ ok: false, message: "" } as const),
    [nodes, edges, groupId],
  );
  const hermesVerdict = useMemo(
    () =>
      groupId
        ? evaluateGroupHermesImages(nodes, edges, groupId)
        : ({ ok: false, message: "" } as const),
    [nodes, edges, groupId],
  );

  const activeColor = normalizeGroupColorToken(groupNode?.data.groupColorToken);
  const activeColorOption = resolveGroupColorToken(groupNode?.data.groupColorToken);

  if (!visible || !pos || !groupId) return null;

  const togglePopover = (kind: Exclude<PopoverKind, null>) => {
    setOpenPopover((prev) => (prev === kind ? null : kind));
  };

  const onPickColor = (token: GroupColorToken | null) => {
    setGroupColorToken(groupId, token);
    setOpenPopover(null);
  };

  const onArrange = (mode: "grid" | "horizontal" | "vertical") => {
    arrangeGroupMembers(groupId, mode);
    const label = mode === "grid" ? "宫格" : mode === "horizontal" ? "水平" : "垂直";
    setStatusText(`已对组内节点${label}排列`);
    setOpenPopover(null);
  };

  return (
    <div
      className="multiSelToolbar groupToolbar"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, -100%)",
        zIndex: CANVAS_Z.toolbar + 1,
      }}
      role="toolbar"
      aria-label="分组操作"
    >
      <div className="multiSelToolbarInner groupToolbarInner" ref={toolbarRef}>
        <div className="groupToolbarLeft">
          <div className="groupToolbarPopoverAnchor">
            {openPopover === "color" ? (
              <div
                className="groupToolbarPopover groupToolbarPopover--color"
                role="dialog"
                aria-label="组底色"
              >
                <button
                  type="button"
                  className={`groupToolbarColorDot${activeColor === null ? " groupToolbarColorDot--active" : ""}`}
                  title="无底色"
                  onClick={() => onPickColor(null)}
                >
                  <IconColorNone />
                </button>
                {GROUP_COLOR_GRID.map((id) => {
                  const c = COLOR_BY_ID.get(id)!;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`groupToolbarColorDot${activeColor === id ? " groupToolbarColorDot--active" : ""}`}
                      title={c.label}
                      style={{ background: c.fill }}
                      onClick={() => onPickColor(id)}
                    />
                  );
                })}
              </div>
            ) : null}

            <button
              type="button"
              className={`groupToolbarIconBtn${openPopover === "color" ? " groupToolbarIconBtn--active" : ""}`}
              title="组底色"
              aria-expanded={openPopover === "color"}
              aria-haspopup="dialog"
              onClick={() => togglePopover("color")}
            >
              <span
                className="groupToolbarColorTrigger"
                style={
                  activeColorOption
                    ? { background: activeColorOption.fill, borderColor: activeColorOption.border }
                    : undefined
                }
              />
            </button>
          </div>

          <div className="groupToolbarPopoverAnchor">
            {openPopover === "arrange" ? (
              <div
                className="groupToolbarPopover groupToolbarPopover--arrange"
                role="menu"
                aria-label="组内排列"
              >
                <button type="button" className="groupToolbarMenuItem" role="menuitem" onClick={() => onArrange("grid")}>
                  <IconGrid />
                  宫格排列
                </button>
                <button
                  type="button"
                  className="groupToolbarMenuItem"
                  role="menuitem"
                  onClick={() => onArrange("horizontal")}
                >
                  <IconLayoutH />
                  水平排列
                </button>
                <button
                  type="button"
                  className="groupToolbarMenuItem"
                  role="menuitem"
                  onClick={() => onArrange("vertical")}
                >
                  <IconLayoutV />
                  垂直排列
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className={`groupToolbarIconBtn${openPopover === "arrange" ? " groupToolbarIconBtn--active" : ""}`}
              title="组内排列"
              aria-expanded={openPopover === "arrange"}
              aria-haspopup="menu"
              onClick={() => togglePopover("arrange")}
            >
              <IconGrid />
            </button>
          </div>
        </div>

        <span className="multiSelSep" aria-hidden />

        <button
          type="button"
          className="multiSelBtn multiSelBtn--accent"
          title="从组内入口节点依次执行子图（Ctrl+Enter）"
          disabled={isGraphRunning}
          onClick={() => void runGroupSubgraph(groupId)}
        >
          <IconPlay />
          整组执行
        </button>
        <button
          type="button"
          className={`multiSelBtn${hermesVerdict.ok ? " multiSelBtn--accent" : ""}`}
          title={
            hermesVerdict.ok
              ? `Hermes 组内出图：${hermesVerdict.readyShotCount} 镜，按全局拆镜策略排队（缺图节点会自动补建）`
              : hermesVerdict.message
          }
          disabled={isGraphRunning || !projectPath || !hermesVerdict.ok}
          onClick={() => void runGroupHermesImages(groupId)}
        >
          <IconHermes />
          Hermes 出图
        </button>
        <button
          type="button"
          className="multiSelBtn"
          title="保存分组为工作流（本机 / 工程 .canvasflow/workflows）"
          disabled={isGraphRunning}
          onClick={() => useCanvasUiStore.getState().openSaveWorkflowDialog()}
        >
          <IconToolbox />
          存工作流
        </button>
        <button
          type="button"
          className={`multiSelBtn${!storyboard && convertVerdict.ok ? " multiSelBtn--accent" : ""}`}
          title={
            storyboard
              ? "已是分镜组"
              : convertVerdict.ok
                ? "标记为分镜批次并绑定脚本镜头"
                : convertVerdict.message
          }
          disabled={isGraphRunning || storyboard || !convertVerdict.ok}
          onClick={() => convertGroupToStoryboard(groupId)}
        >
          <IconStoryboard />
          {storyboard ? "已是分镜组" : "转分镜组"}
        </button>

        <button
          type="button"
          className="multiSelBtn"
          title="复制整组副本（含嵌套子组与组内连线，Ctrl+Shift+C）"
          disabled={isGraphRunning}
          onClick={() => duplicateGroup(groupId)}
        >
          <IconDuplicate />
          创建副本
        </button>

        <span className="multiSelSep" aria-hidden />

        <button type="button" className="multiSelBtn" title="解散分组（Ctrl+Shift+G）" onClick={() => ungroupSelectedNodes()}>
          <IconUngroup />
          解组
        </button>
        <button
          type="button"
          className="multiSelBtn"
          title="将组内媒体复制到工程 assets/export/"
          disabled={isGraphRunning}
          onClick={() => void exportGroupMedia(groupId)}
        >
          <IconDownload />
          批量下载
        </button>
      </div>
    </div>
  );
}
