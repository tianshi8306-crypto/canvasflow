/**
 * 统一节点锚点：边框接线 + 外侧热区 + 悬停显「+」+ 磁吸跟随 + 十字准星。
 * L1 Handle 固定边框；L3 圆钮/准星仅视觉，不触发 updateNodeInternals。
 */
import type React from "react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Handle,
  Position,
  useNodeId,
  useStore,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { dispatchAnchorMenuPick } from "@/lib/nodeAnchorDispatch";
import type { AnchorMenuKey } from "@/lib/nodeAnchorMenus";
import {
  anchorHandleTitle,
  anchorMenuTitle,
  getIncomingMenuRows,
  getOutgoingMenuRows,
  type AnchorMenuGraphContext,
  type AnchorMenuRow,
} from "@/lib/nodeAnchorMenus";
import { RF_NODE_ANCHOR_CLASS } from "@/lib/canvasInteraction";
import {
  clientToKnobPos,
  dispatchHandleConnectPointerDown,
  isPointerInAnchorZone,
  type KnobPos,
} from "@/lib/anchorKnobInteraction";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useAnchorMenuPopover } from "@/hooks/canvas/useAnchorMenuPopover";
import type { AnchorMenuSide } from "@/hooks/canvas/useAnchorMenuPopover";
import { AnchorMenuPopover } from "@/components/nodes/anchors/AnchorMenuPopover";
import { useAnchorMenuDismiss } from "@/components/nodes/anchors/useAnchorMenuDismiss";
import { defaultAnchorMenuIcon } from "@/components/nodes/anchors/anchorMenuIcons";

export type CanvasNodeAnchorsProps = {
  nodeId: string;
  nodeType: string | undefined;
};

const CLICK_DRAG_THRESHOLD_PX = 6;

type Side = "left" | "right";

function PlusGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

type AnchorSideProps = {
  side: Side;
  menuDirection: AnchorMenuSide;
  handleId: string;
  handleType: "source" | "target";
  zoneRef: RefObject<HTMLDivElement | null>;
  onMenuOpen: (side: AnchorMenuSide, clientX: number, clientY: number) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (side: AnchorMenuSide, e: React.PointerEvent) => void;
};

function CanvasAnchorSide({
  side,
  menuDirection,
  handleId,
  handleType,
  zoneRef,
  onMenuOpen,
  onPointerDown,
  onPointerUp,
}: AnchorSideProps) {
  const [zoneHover, setZoneHover] = useState(false);
  const [magnetized, setMagnetized] = useState(false);
  const [knobPos, setKnobPos] = useState<KnobPos | null>(null);
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const connectionToNode = useStore((s) => s.connection.toNode);
  const connectionIsValid = useStore((s) => s.connection.isValid);
  const zoom = useStore((s) => s.transform[2]);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const handleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodeId) return;
    const sync = () => updateNodeInternals(nodeId);
    const id = window.requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", sync);
    };
  }, [nodeId, updateNodeInternals]);

  const syncKnobToPointer = useCallback(
    (r: DOMRect, clientX: number, clientY: number) => {
      if (!isPointerInAnchorZone(r, clientX, clientY)) {
        setMagnetized(false);
        setKnobPos(null);
        return;
      }
      setMagnetized(true);
      setKnobPos(clientToKnobPos(r, clientX, clientY, zoom));
    },
    [zoom],
  );

  const onZonePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = zoneRef.current;
      if (!el) return;
      syncKnobToPointer(el.getBoundingClientRect(), e.clientX, e.clientY);
    },
    [syncKnobToPointer, zoneRef],
  );

  const onZonePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      setZoneHover(true);
      const el = zoneRef.current;
      if (!el) return;
      syncKnobToPointer(el.getBoundingClientRect(), e.clientX, e.clientY);
    },
    [syncKnobToPointer, zoneRef],
  );

  const onZonePointerLeave = useCallback(() => {
    setZoneHover(false);
    setMagnetized(false);
    setKnobPos(null);
  }, []);

  const showKnob = zoneHover || magnetized || connectionInProgress;
  const position = side === "left" ? Position.Left : Position.Right;
  const titleHint = anchorHandleTitle(menuDirection);

  const isConnectTarget = connectionInProgress && connectionToNode?.id === nodeId;
  const zoneExtra = [
    magnetized ? "simple-anchor-zone--magnet" : "",
    zoneHover ? "flowMagnetZone--hot" : "",
    isConnectTarget
      ? connectionIsValid === false
        ? "flowMagnetZone--connectTarget flowMagnetZone--connectTargetInvalid"
        : "flowMagnetZone--connectTarget flowMagnetZone--connectTargetValid"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const onHandleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onMenuOpen(menuDirection, e.clientX, e.clientY);
  };

  const onZonePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      onPointerDown(e);

      if ((e.target as HTMLElement).closest(".react-flow__handle")) return;

      const handleEl = handleRef.current;
      if (!handleEl) return;

      e.stopPropagation();
      dispatchHandleConnectPointerDown(handleEl, e);
    },
    [onPointerDown],
  );

  const knobStyle =
    magnetized && knobPos
      ? { left: knobPos.left, top: knobPos.top, transform: "translate(-50%, -50%)" as const }
      : undefined;

  return (
    <div
      ref={zoneRef as React.Ref<HTMLDivElement>}
      className={`simple-anchor-zone flowMagnetZone simple-anchor-zone--${side} flowMagnetZone--${side} ${RF_NODE_ANCHOR_CLASS} ${zoneExtra}`}
      data-side={side}
      onPointerDown={onZonePointerDown}
      onPointerUp={(e) => onPointerUp(menuDirection, e)}
      onPointerMove={onZonePointerMove}
      onPointerEnter={onZonePointerEnter}
      onPointerLeave={onZonePointerLeave}
    >
      <Handle
        ref={handleRef}
        type={handleType}
        position={position}
        id={handleId}
        className={`nodeBorderHandle nodeBorderHandle--${side} simple-anchor simple-anchor--${side} flowMagnetHandle flowMagnetHandle--unified flowMagnetHandle--${side} ${RF_NODE_ANCHOR_CLASS}`}
        style={{ cursor: "crosshair" }}
        onClick={onHandleClick}
        title={titleHint}
        aria-label={titleHint}
      />
      <div
        className={`simple-anchor-knob-wrap flowMagnetKnobWrap${showKnob ? " simple-anchor-knob-wrap--visible flowMagnetKnobWrap--visible" : ""}`}
        style={knobStyle}
        aria-hidden={!showKnob}
      >
        <span className="simple-anchor-glyph flowMagnetKnobGlyph" aria-hidden>
          <PlusGlyph />
        </span>
        {magnetized ? (
          <>
            <span className="anchor-crosshair-h" />
            <span className="anchor-crosshair-v" />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function CanvasNodeAnchors({ nodeId, nodeType }: CanvasNodeAnchorsProps) {
  // 菜单上下文仅在菜单打开时读取最新状态，避免订阅全量 nodes/edges 导致非必要重渲染
  const getMenuCtx = useCallback((): AnchorMenuGraphContext => {
    const state = useProjectStore.getState();
    return { anchorNodeId: nodeId, nodes: state.nodes, edges: state.edges };
  }, [nodeId]);
  const updateNodeInternals = useUpdateNodeInternals();
  const popRef = useRef<HTMLDivElement>(null);
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const { open, openAtCursor, close, menuStyle } = useAnchorMenuPopover(nodeId);

  useAnchorMenuDismiss(open !== null, close, popRef, [leftZoneRef, rightZoneRef]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => updateNodeInternals(nodeId));
    return () => window.cancelAnimationFrame(id);
  }, [nodeId, updateNodeInternals]);

  const handleMenuPick = useCallback(
    (key: AnchorMenuKey) => {
      if (!open) return;
      dispatchAnchorMenuPick({
        anchorNodeId: nodeId,
        anchorType: nodeType,
        direction: open.side,
        key,
      });
      close();
    },
    [nodeId, nodeType, open, close],
  );

  const onZonePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onZonePointerUp = useCallback(
    (side: AnchorMenuSide, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) return;
      if (useCanvasUiStore.getState().anchorConnectDrag) return;
      if (connectionInProgress) return;
      e.stopPropagation();
      openAtCursor(side, e.clientX, e.clientY);
    },
    [openAtCursor, connectionInProgress],
  );

  // 仅在菜单打开时懒计算上下文，避免每帧都依赖全量 nodes/edges
  const menuCtx = open !== null ? getMenuCtx() : undefined;
  const menuItems: AnchorMenuRow[] =
    open?.side === "incoming" && menuCtx
      ? getIncomingMenuRows(nodeType, menuCtx)
      : open?.side === "outgoing" && menuCtx
        ? getOutgoingMenuRows(nodeType, menuCtx)
        : [];
  const menuTitle = open?.side ? anchorMenuTitle(open.side) : "";

  return (
    <>
      <div className={`simple-anchor-layer flowMagnetLayer ${RF_NODE_ANCHOR_CLASS}`} aria-hidden={false}>
        <CanvasAnchorSide
          side="left"
          menuDirection="incoming"
          handleId="in"
          handleType="target"
          zoneRef={leftZoneRef}
          onMenuOpen={openAtCursor}
          onPointerDown={onZonePointerDown}
          onPointerUp={onZonePointerUp}
        />
        <CanvasAnchorSide
          side="right"
          menuDirection="outgoing"
          handleId="out"
          handleType="source"
          zoneRef={rightZoneRef}
          onMenuOpen={openAtCursor}
          onPointerDown={onZonePointerDown}
          onPointerUp={onZonePointerUp}
        />
      </div>
      <AnchorMenuPopover
        popRef={popRef}
        open={open !== null}
        menuStyle={menuStyle}
        title={menuTitle}
        rows={menuItems}
        renderIcon={defaultAnchorMenuIcon}
        onPick={handleMenuPick}
        minWidth={200}
        maxHeight="min(420px, 70vh)"
      />
    </>
  );
}
