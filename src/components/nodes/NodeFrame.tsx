import { createPortal } from "react-dom";
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import { useProjectStore } from "@/store/projectStore";
import { NodeRunBadge } from "@/components/nodes/NodeRunBadge";
import { NodeStatusBadge } from "@/components/nodes/NodeStatusBadge";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";

type NodeFrameProps = {
  /** 未设置自定义名称时的默认标题（如「文本」） */
  defaultTitle: string;
  /** 自定义名称，对应 FlowNodeData.label */
  label?: string;
  nodeId: string;
  selected: boolean;
  tone: "text" | "script" | "image" | "video" | "audio" | "llm" | "mediaImport";
  subtitle?: string;
  /** 标题左侧图标（如脚本生成器文档图标） */
  icon?: ReactNode;
  /** 标题行右侧操作（如脚本节点全屏展开） */
  actions?: ReactNode;
  /** 追加到根节点 class（如 Lib 脚本节点加宽/态） */
  rootClassName?: string;
  /** 根节点 ref（用于测量节点几何，如外部浮层锚定） */
  rootRef?: Ref<HTMLDivElement>;
  /**
   * 展开分体：上卡为节点面板（含标题），下卡为提示词与生成参数；背景断开，随画布缩放一体缩放。
   * 为 true 时使用 upperBody / lowerBody，忽略 children。
   */
  expandedSplit?: boolean;
  /** 可选：渲染在上卡外部顶部（不与上卡重叠） */
  expandedSplitTopOutside?: ReactNode;
  /** 通用上浮层：锚定上卡顶部（屏幕坐标），用于固定像素大小的按钮条 */
  floatingTopOverlay?: ReactNode;
  /** 通用下浮层：锚定上卡底部（屏幕坐标），用于固定像素大小的下方输入模块 */
  floatingBottomOverlay?: ReactNode;
  /** 上浮层到上卡顶部偏移（屏幕 px） */
  floatingTopOffsetPx?: number;
  /** 下浮层到上卡底部偏移（屏幕 px） */
  floatingBottomOffsetPx?: number;
  /** 浮层可见控制（如拖拽时隐藏上浮层） */
  floatingOverlaysVisible?: boolean;
  upperBody?: ReactNode;
  /** 可选：上卡与下卡之间的插槽（不占上卡内部，水平居中） */
  expandedSplitBetween?: ReactNode;
  lowerBody?: ReactNode;
  children?: ReactNode;
};

const toneLabel: Record<NodeFrameProps["tone"], string> = {
  text: "文本",
  script: "脚本",
  image: "图片",
  video: "视频",
  audio: "音频",
  llm: "LLM",
  mediaImport: "媒体导入",
};

export function NodeFrame({
  defaultTitle,
  label,
  nodeId,
  selected,
  tone,
  subtitle,
  icon,
  actions,
  rootClassName,
  rootRef,
  expandedSplit,
  expandedSplitTopOutside,
  floatingTopOverlay,
  floatingBottomOverlay,
  floatingTopOffsetPx = 10,
  floatingBottomOffsetPx = 12,
  floatingOverlaysVisible = true,
  upperBody,
  expandedSplitBetween,
  lowerBody,
  children,
}: NodeFrameProps) {
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const runState = useProjectStore((s) => s.nodeRunStateById[nodeId]);
  const node = useProjectStore((s) => s.nodes.find((n) => n.id === nodeId));
  const nodeStatus = node?.data.status;
  const displayName = label?.trim() ? label.trim() : defaultTitle;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [agentBusyCount, setAgentBusyCount] = useState(0);
  const [asyncProgress, setAsyncProgress] = useState(2);
  const upperElRef = useRef<HTMLElement | null>(null);
  const [overlayGeom, setOverlayGeom] = useState<{ centerX: number; upperTop: number; upperBottom: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(displayName);
    }
  }, [displayName, editing]);

  useEffect(() => {
    const onEvt = (ev: Event) => {
      const detail = (ev as CustomEvent<NodeAgentRuntimeEvent>).detail;
      if (!detail || detail.nodeId !== nodeId) return;
      if (detail.phase === "start") {
        setAgentBusyCount((n) => n + 1);
        return;
      }
      if (detail.phase === "end" || detail.phase === "error") {
        setAgentBusyCount((n) => Math.max(0, n - 1));
      }
    };
    window.addEventListener("node-agent-event", onEvt as EventListener);
    return () => window.removeEventListener("node-agent-event", onEvt as EventListener);
  }, [nodeId]);

  const nodeBusy = runState === "running" || agentBusyCount > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAsyncProgress(2);
    if (!nodeBusy) return;
    const timer = window.setInterval(() => {
       
      setAsyncProgress((prev) => {
        if (prev >= 88) return prev;
        const step = Math.max(1, Math.ceil((88 - prev) / 14));
        return Math.min(88, prev + step);
      });
    }, 560);
    return () => window.clearInterval(timer);
  }, [nodeBusy]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const commit = () => {
    const t = draft.trim();
    updateNodeData(nodeId, { label: t || undefined });
    setEditing(false);
  };

  const rootClass = ["nodeCard", `nodeTone-${tone}`, rootClassName].filter(Boolean).join(" ");
  const useSplit = Boolean(
    expandedSplit &&
      upperBody !== undefined &&
      (lowerBody !== undefined || floatingBottomOverlay !== undefined || floatingTopOverlay !== undefined),
  );

  useEffect(() => {
    if (!useSplit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOverlayGeom(null);
      return;
    }
    let rafId = 0;
    const tick = () => {
      const upper = upperElRef.current;
      if (upper) {
        const rect = upper.getBoundingClientRect();
        const next = {
          centerX: rect.left + rect.width / 2,
          upperTop: rect.top,
          upperBottom: rect.bottom,
        };
        setOverlayGeom((prev) =>
          prev &&
          Math.abs(prev.centerX - next.centerX) < 0.5 &&
          Math.abs(prev.upperTop - next.upperTop) < 0.5 &&
          Math.abs(prev.upperBottom - next.upperBottom) < 0.5
            ? prev
            : next,
        );
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [useSplit]);

  const floatingOverlays =
    useSplit && overlayGeom && floatingOverlaysVisible && typeof document !== "undefined"
      ? createPortal(
          <>
            {floatingTopOverlay ? (
              <div
                className="nodeFloatingTopOverlayHost"
                style={{
                  position: "fixed",
                  left: `${overlayGeom.centerX}px`,
                  top: `${overlayGeom.upperTop - floatingTopOffsetPx}px`,
                  transform: "translate(-50%, -100%)",
                  zIndex: 40,
                }}
              >
                {floatingTopOverlay}
              </div>
            ) : null}
            {floatingBottomOverlay ? (
              <div
                className="nodeFloatingBottomOverlayHost"
                style={{
                  position: "fixed",
                  left: `${overlayGeom.centerX}px`,
                  top: `${overlayGeom.upperBottom + floatingBottomOffsetPx}px`,
                  transform: "translateX(-50%)",
                  zIndex: 40,
                }}
              >
                {floatingBottomOverlay}
              </div>
            ) : null}
          </>,
          document.body,
        )
      : null;

  const setRootRefs = (el: HTMLDivElement | null) => {
    if (!rootRef) return;
    if (typeof rootRef === "function") {
      rootRef(el);
    } else if (typeof rootRef === "object" && rootRef !== null) {
      // eslint-disable-next-line react-hooks/immutability
      (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }
  };

  const titleRow = (
    <div className="nodeTitle">
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        {icon ? <span className="nodeTitleIcon">{icon}</span> : null}
        {editing ? (
          <input
            ref={inputRef}
            className={`nodeTitleInput ${RF_NODE_INPUT_CLASS}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(displayName);
                setEditing(false);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="名称"
          />
        ) : (
          <strong
            className="nodeTitleName"
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title="双击编辑名称"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {displayName}
          </strong>
        )}
        <span className="nodeBadge">{toneLabel[tone]}</span>
        <NodeRunBadge nodeId={nodeId} />
        <NodeStatusBadge status={nodeStatus} size="sm" />
      </div>
      {actions ? <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{actions}</div> : null}
    </div>
  );

  if (useSplit) {
    return (
      <>
        {floatingOverlays}
        <div
          className={`${rootClass} nodeCard--expandedSplit`}
          data-selected={selected ? "true" : "false"}
          ref={setRootRefs}
        >
          <div className="nodeExpandedSplit">
          {expandedSplitTopOutside ? (
            <div className="nodeExpandedSplitTopOutside" onPointerDown={(e) => e.stopPropagation()}>
              {expandedSplitTopOutside}
            </div>
          ) : null}
          <section className="nodeExpandedSplitUpper" ref={upperElRef}>
            {titleRow}
            {subtitle ? <div className="nodeSubTitle">{subtitle}</div> : null}
            <div className="nodeExpandedSplitUpperMain">{upperBody}</div>
          </section>
          {expandedSplitBetween ? (
            <div className="nodeExpandedSplitBetween" onPointerDown={(e) => e.stopPropagation()}>
              {expandedSplitBetween}
            </div>
          ) : null}
          {lowerBody !== undefined ? (
            <section className="nodeExpandedSplitLower">
              {nodeBusy ? (
                <>
                  <div className="nodeAsyncShimmer" aria-hidden />
                  <div className="nodeAsyncBadge" aria-live="polite">
                    生成中 {asyncProgress}%...
                  </div>
                </>
              ) : null}
              {lowerBody}
            </section>
          ) : null}
        </div>
        </div>
      </>
    );
  }

  return (
    <div className={rootClass} data-selected={selected ? "true" : "false"} ref={setRootRefs}>
      {nodeBusy ? (
        <>
          <div className="nodeAsyncShimmer" aria-hidden />
          <div className="nodeAsyncBadge" aria-live="polite">
            生成中 {asyncProgress}%...
          </div>
        </>
      ) : null}
      {titleRow}
      {subtitle ? <div className="nodeSubTitle">{subtitle}</div> : null}
      <div className="nodeBody">{children}</div>
    </div>
  );
}
