/**
 * 极简节点锚点：左右对称外移、磁吸跟随指针、拖线/菜单。
 */
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
  SIMPLE_ANCHOR_KNOB,
  SIMPLE_ANCHOR_MAGNET_RADIUS,
  getSimpleAnchorRestingKnobPos,
} from "@/lib/simpleAnchorGeometry";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useAnchorMenuPopover } from "@/hooks/canvas/useAnchorMenuPopover";
import type { AnchorMenuSide } from "@/hooks/canvas/useAnchorMenuPopover";
import { AnchorMenuPopover } from "@/components/nodes/anchors/AnchorMenuPopover";
import { useAnchorMenuDismiss } from "@/components/nodes/anchors/useAnchorMenuDismiss";
import { simpleAnchorMenuIcon } from "@/components/nodes/anchors/anchorMenuIcons";

interface SimpleAnchorsProps {
  nodeId: string;
  nodeType: string | undefined;
}

const INCOMING_MENU_DEFAULT = [
  { key: "textNode" as const, label: "文本" },
  { key: "imageNode" as const, label: "图片" },
];

const INCOMING_MENU_TEXT_NODE = [
  { key: "imageNode" as const, label: "图片" },
  { key: "videoNode" as const, label: "视频" },
  { key: "scriptNode" as const, label: "脚本" },
];

function incomingMenuFor(nodeType: string | undefined) {
  return nodeType === "textNode" ? INCOMING_MENU_TEXT_NODE : INCOMING_MENU_DEFAULT;
}

const OUTGOING_MENU = [
  { key: "textNode" as const, label: "文本" },
  { key: "imageNode" as const, label: "图片" },
  { key: "videoNode" as const, label: "视频" },
];

const CLICK_DRAG_THRESHOLD_PX = 6;
const KNOB_R = SIMPLE_ANCHOR_KNOB / 2;

type KnobPos = { left: number; top: number };
type Side = "left" | "right";

function PlusGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function getRestingKnobPos(zone: DOMRect, side: Side): KnobPos {
  return getSimpleAnchorRestingKnobPos(zone.width, zone.height, side);
}

function clientToKnobPos(zone: DOMRect, clientX: number, clientY: number): KnobPos {
  const pad = KNOB_R + 4;
  const left = clientX - zone.left - KNOB_R;
  const top = clientY - zone.top - KNOB_R;
  return {
    left: Math.max(pad, Math.min(zone.width - pad - KNOB_R, left)),
    top: Math.max(pad, Math.min(zone.height - pad - KNOB_R, top)),
  };
}

function distanceToResting(zone: DOMRect, side: Side, clientX: number, clientY: number): number {
  const rest = getRestingKnobPos(zone, side);
  const rcx = zone.left + rest.left + KNOB_R;
  const rcy = zone.top + rest.top + KNOB_R;
  return Math.hypot(clientX - rcx, clientY - rcy);
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

function SimpleAnchorSide({
  side,
  menuDirection,
  handleId,
  handleType,
  zoneRef,
  onMenuOpen,
  onPointerDown,
  onPointerUp,
}: AnchorSideProps) {
  const [magnetPos, setMagnetPos] = useState<KnobPos | null>(null);
  const [magnetized, setMagnetized] = useState(false);
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();

  const refreshHandlePosition = useCallback(() => {
    if (!nodeId) return;
    const id = window.requestAnimationFrame(() => updateNodeInternals(nodeId));
    return () => window.cancelAnimationFrame(id);
  }, [nodeId, updateNodeInternals]);

  useEffect(() => {
    const cancel = refreshHandlePosition();
    const onResize = () => refreshHandlePosition();
    window.addEventListener("resize", onResize);
    return () => {
      cancel?.();
      window.removeEventListener("resize", onResize);
    };
  }, [refreshHandlePosition]);

  useEffect(() => {
    return refreshHandlePosition();
  }, [magnetized, magnetPos, refreshHandlePosition]);

  const syncMagnet = useCallback(
    (clientX: number, clientY: number) => {
      const z = zoneRef.current;
      if (!z) return;
      const r = z.getBoundingClientRect();
      const dist = distanceToResting(r, side, clientX, clientY);
      if (dist <= SIMPLE_ANCHOR_MAGNET_RADIUS) {
        setMagnetized(true);
        setMagnetPos(clientToKnobPos(r, clientX, clientY));
      } else {
        setMagnetized(false);
        setMagnetPos(null);
      }
    },
    [side, zoneRef],
  );

  const onZonePointerMove = useCallback(
    (e: React.PointerEvent) => {
      syncMagnet(e.clientX, e.clientY);
    },
    [syncMagnet],
  );

  const onZonePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      syncMagnet(e.clientX, e.clientY);
    },
    [syncMagnet],
  );

  const onZonePointerLeave = useCallback(() => {
    setMagnetized(false);
    setMagnetPos(null);
  }, []);

  const showKnob =
    magnetized || connectionInProgress;
  const position = side === "left" ? Position.Left : Position.Right;
  const titleHint = menuDirection === "incoming" ? "添加上游输入" : "引出输出";

  return (
    <div
      ref={zoneRef}
      className={`simple-anchor-zone simple-anchor-zone--${side}${magnetized ? " simple-anchor-zone--magnet" : ""}`}
      onPointerDown={onPointerDown}
      onPointerUp={(e) => onPointerUp(menuDirection, e)}
      onPointerMove={onZonePointerMove}
      onPointerEnter={onZonePointerEnter}
      onPointerLeave={onZonePointerLeave}
    >
      <div
        className={`simple-anchor-knob-wrap${showKnob ? " simple-anchor-knob-wrap--visible" : ""}`}
        style={magnetized && magnetPos ? { left: magnetPos.left, top: magnetPos.top } : undefined}
      >
        <Handle
          type={handleType}
          position={position}
          id={handleId}
          className={`simple-anchor simple-anchor--${side}`}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: "none",
          }}
          title={titleHint}
          onClick={(e) => {
            e.stopPropagation();
            onMenuOpen(menuDirection, e.clientX, e.clientY);
          }}
        >
          <span className="simple-anchor-glyph" aria-hidden>
            <PlusGlyph />
          </span>
        </Handle>
        {magnetized ? (
          <span className="simple-anchor-aim" aria-hidden>
            <span className="anchor-crosshair-h" />
            <span className="anchor-crosshair-v" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SimpleAnchors({ nodeId, nodeType }: SimpleAnchorsProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const popRef = useRef<HTMLDivElement>(null);
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
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
      e.stopPropagation();
      openAtCursor(side, e.clientX, e.clientY);
    },
    [openAtCursor],
  );

  const menuItems = open?.side === "incoming" ? incomingMenuFor(nodeType) : OUTGOING_MENU;
  const menuTitle = open?.side === "incoming" ? "添加上游输入" : "引出输出";

  return (
    <div className="simple-anchor-layer">
      <SimpleAnchorSide
        side="left"
        menuDirection="incoming"
        handleId="in"
        handleType="target"
        zoneRef={leftZoneRef}
        onMenuOpen={openAtCursor}
        onPointerDown={onZonePointerDown}
        onPointerUp={onZonePointerUp}
      />
      <SimpleAnchorSide
        side="right"
        menuDirection="outgoing"
        handleId="out"
        handleType="source"
        zoneRef={rightZoneRef}
        onMenuOpen={openAtCursor}
        onPointerDown={onZonePointerDown}
        onPointerUp={onZonePointerUp}
      />
      <AnchorMenuPopover
        popRef={popRef}
        open={open !== null}
        menuStyle={menuStyle}
        title={menuTitle}
        rows={menuItems}
        renderIcon={simpleAnchorMenuIcon}
        onPick={handleMenuPick}
      />
    </div>
  );
}
