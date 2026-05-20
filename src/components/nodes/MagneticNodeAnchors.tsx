import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import { Handle, Position, useStore, useUpdateNodeInternals, useNodeId } from "@xyflow/react";
import { dispatchAnchorMenuPick } from "@/lib/nodeAnchorDispatch";
import {
  getIncomingExtraRows,
  getStandardAnchorRows,
  type AnchorMenuRow,
} from "@/lib/nodeAnchorMenus";
import { useAnchorMenuPopover } from "@/hooks/canvas/useAnchorMenuPopover";
import { AnchorMenuPopover } from "@/components/nodes/anchors/AnchorMenuPopover";
import { useAnchorMenuDismiss } from "@/components/nodes/anchors/useAnchorMenuDismiss";
import { defaultAnchorMenuIcon } from "@/components/nodes/anchors/anchorMenuIcons";

const KNOB = 26;
const KNOB_R = KNOB / 2;

type KnobPos = { left: number; top: number };
type Side = "left" | "right";

type Props = {
  nodeId: string;
  nodeType: string | undefined;
};

function centerToKnobStyle(z: DOMRect, cx: number, cy: number): KnobPos {
  return { left: cx - z.left - KNOB_R, top: cy - z.top - KNOB_R };
}

function edgeCenter(side: Side, z: DOMRect): { cx: number; cy: number } {
  const cy = z.top + z.height / 2;
  const cx = side === "left" ? z.right - z.width / 2 : z.left + z.width / 2;
  return { cx, cy };
}

function PlusGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type AnchorSideProps = {
  zoneRef: RefObject<HTMLDivElement | null>;
  side: Side;
  menuDirection: "incoming" | "outgoing";
  handleId: string;
  handleType: "source" | "target";
  onMenuOpen: (side: "incoming" | "outgoing", clientX: number, clientY: number) => void;
};

function AnchorSide({ zoneRef, side, menuDirection, handleId, handleType, onMenuOpen }: AnchorSideProps) {
  const [hot, setHot] = useState(false);
  const [knobPos, setKnobPos] = useState<KnobPos>({ left: 0, top: 0 });
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const connectionToNode = useStore((s) => s.connection.toNode);
  const connectionIsValid = useStore((s) => s.connection.isValid);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();

  const show = hot || connectionInProgress;

  const isConnectTarget = connectionInProgress && connectionToNode?.id === nodeId;
  const zoneClass = isConnectTarget
    ? connectionIsValid === false
      ? "flowMagnetZone--connectTarget flowMagnetZone--connectTargetInvalid"
      : "flowMagnetZone--connectTarget flowMagnetZone--connectTargetValid"
    : hot
      ? "flowMagnetZone--hot"
      : "";

  const placeOnEdge = useCallback(() => {
    const z = zoneRef.current;
    if (!z) return;
    const r = z.getBoundingClientRect();
    const { cx, cy } = edgeCenter(side, r);
    setKnobPos(centerToKnobStyle(r, cx, cy));
  }, [side, zoneRef]);

  useEffect(() => {
    placeOnEdge();
    const onResize = () => placeOnEdge();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [placeOnEdge]);

  useEffect(() => {
    if (!nodeId) return;
    const id = window.requestAnimationFrame(() => updateNodeInternals(nodeId));
    return () => window.cancelAnimationFrame(id);
  }, [nodeId, updateNodeInternals, knobPos.left, knobPos.top]);

  const position = side === "left" ? Position.Left : Position.Right;
  const titleHint = menuDirection === "incoming" ? "添加上下文" : "引用该节点生成";

  const onHandleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onMenuOpen(menuDirection, e.clientX, e.clientY);
  };

  return (
    <div
      ref={zoneRef as Ref<HTMLDivElement>}
      className={`flowMagnetZone flowMagnetZone--${side} ${zoneClass}`}
      data-side={side}
      onPointerEnter={() => {
        setHot(true);
        placeOnEdge();
      }}
      onPointerLeave={() => setHot(false)}
    >
      <div
        className={`flowMagnetKnobWrap ${show ? "flowMagnetKnobWrap--visible" : ""}`}
        style={{ left: knobPos.left, top: knobPos.top }}
      >
        <Handle
          type={handleType}
          position={position}
          id={handleId}
          className="flowMagnetHandle flowMagnetHandle--unified"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: "none",
            opacity: show ? 1 : 0,
            visibility: show ? "visible" : "hidden",
            pointerEvents: show ? "auto" : "none",
            cursor: "default",
          }}
          onClick={onHandleClick}
          title={titleHint}
          aria-label={titleHint}
        >
          <span className="flowMagnetKnobGlyph" aria-hidden>
            <PlusGlyph />
          </span>
        </Handle>
      </div>
    </div>
  );
}

export function MagneticNodeAnchors({ nodeId, nodeType }: Props) {
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const { open, openAtCursor, close, menuStyle } = useAnchorMenuPopover(nodeId);

  useAnchorMenuDismiss(open !== null, close, popRef, [leftZoneRef, rightZoneRef]);

  const rows: AnchorMenuRow[] =
    open?.side === "incoming"
      ? [...getIncomingExtraRows(nodeType), ...getStandardAnchorRows()]
      : getStandardAnchorRows();

  const onMenuOpen = useCallback(
    (side: "incoming" | "outgoing", clientX: number, clientY: number) => {
      openAtCursor(side, clientX, clientY);
    },
    [openAtCursor],
  );

  const onPick = (key: AnchorMenuRow["key"]) => {
    if (!open) return;
    dispatchAnchorMenuPick({
      anchorNodeId: nodeId,
      anchorType: nodeType,
      direction: open.side,
      key,
    });
    close();
  };

  const title = open?.side === "incoming" ? "添加上下文" : "引用该节点生成";

  return (
    <>
      <AnchorSide
        zoneRef={leftZoneRef}
        side="left"
        menuDirection="incoming"
        handleId="in"
        handleType="target"
        onMenuOpen={onMenuOpen}
      />
      <AnchorSide
        zoneRef={rightZoneRef}
        side="right"
        menuDirection="outgoing"
        handleId="out"
        handleType="source"
        onMenuOpen={onMenuOpen}
      />
      <AnchorMenuPopover
        popRef={popRef}
        open={open !== null}
        menuStyle={menuStyle}
        title={title}
        rows={rows}
        renderIcon={defaultAnchorMenuIcon}
        onPick={onPick}
        minWidth={200}
        maxHeight="min(420px, 70vh)"
      />
    </>
  );
}
