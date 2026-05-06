import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useStore, useUpdateNodeInternals, useNodeId } from "@xyflow/react";
import { dispatchAnchorMenuPick } from "@/lib/nodeAnchorDispatch";
import {
  getIncomingExtraRows,
  getStandardAnchorRows,
  type AnchorMenuRow,
} from "@/lib/nodeAnchorMenus";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";

/** 锚点直径与半宽（像素），与 CSS .flowMagnetKnobWrap 一致 */
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

/**
 * 固定锚点中心到节点边缘，避免连线端点抖动或与节点出现间隙。
 */
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

function iconForRow(row: AnchorMenuRow): ReactNode {
  const k = row.key;
  if (k === "videoFirstLastSetup" || k === "audioTts" || k === "videoFirstFrameSetup") {
    return (
      <span className="nodeAnchorMenuIcon nodeAnchorMenuIcon--sm" aria-hidden>
        ⚙
      </span>
    );
  }
  if (k === "imageI2iImport") {
    return (
      <span className="nodeAnchorMenuIcon mono" aria-hidden>
        参
      </span>
    );
  }
  return (
    <span className="nodeAnchorMenuIcon mono" aria-hidden>
      {k === "textNode" && "文"}
      {k === "imageNode" && "图"}
      {k === "videoNode" && "视"}
      {k === "ffmpegConcat" && "剪"}
      {k === "audioNode" && "音"}
      {k === "scriptNode" && "剧"}
    </span>
  );
}

type AnchorSideProps = {
  zoneRef: RefObject<HTMLDivElement | null>;
  side: Side;
  menuDirection: "incoming" | "outgoing";
  handleId: string;
  handleType: "source" | "target";
  onMenuOpen: (side: "incoming" | "outgoing", zoneEl: HTMLDivElement | null) => void;
};

function AnchorSide({ zoneRef, side, menuDirection, handleId, handleType, onMenuOpen }: AnchorSideProps) {
  const [hot, setHot] = useState(false);
  const [knobPos, setKnobPos] = useState<KnobPos>({ left: 0, top: 0 });
  const connectionInProgress = useStore((s) => s.connection.inProgress);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();

  const show = hot || connectionInProgress;

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
    onMenuOpen(menuDirection, zoneRef.current);
  };

  return (
    <div
      ref={zoneRef as Ref<HTMLDivElement>}
      className={`flowMagnetZone flowMagnetZone--${side} ${hot ? "flowMagnetZone--hot" : ""}`}
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

/**
 * 节点左右各一个连线锚点：固定在节点边缘中心，悬停时显隐，保证命中与连线稳定。
 */
export function MagneticNodeAnchors({ nodeId, nodeType }: Props) {
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<null | { side: "incoming" | "outgoing"; x: number; y: number }>(null);

  const rows: AnchorMenuRow[] =
    open?.side === "incoming"
      ? [...getIncomingExtraRows(nodeType), ...getStandardAnchorRows()]
      : getStandardAnchorRows();

  const close = useCallback(() => setOpen(null), []);

  const onMenuOpen = useCallback((side: "incoming" | "outgoing", zoneEl: HTMLDivElement | null) => {
    if (!zoneEl) return;
    const r = zoneEl.getBoundingClientRect();
    const x = side === "incoming" ? r.right : r.left;
    const y = r.top + r.height / 2;
    setOpen({ side, x, y });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (popRef.current?.contains(t)) return;
      if (leftZoneRef.current?.contains(t)) return;
      if (rightZoneRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

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

  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popRef}
            className={`nodeAnchorPopover ${RF_NODE_INPUT_CLASS}`}
            role="menu"
            aria-label={title}
            style={{
              position: "fixed",
              left: open.side === "incoming" ? open.x - 8 : open.x + 8,
              top: open.y,
              transform: open.side === "incoming" ? "translate(-100%, -50%)" : "translate(8px, -50%)",
              zIndex: 120,
              minWidth: 200,
              maxHeight: "min(420px, 70vh)",
              overflowY: "auto",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="nodeAnchorPopoverTitle">{title}</div>
            <div className="nodeAnchorPopoverList">
              {rows.map((row) => (
                <button
                  key={`${open.side}-${row.key}`}
                  type="button"
                  role="menuitem"
                  className="nodeAnchorPopoverRow"
                  onClick={() => onPick(row.key)}
                >
                  <span className="nodeAnchorPopoverRowIcon">{iconForRow(row)}</span>
                  <span className="nodeAnchorPopoverRowLabel">{row.label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

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
      {popover}
    </>
  );
}
