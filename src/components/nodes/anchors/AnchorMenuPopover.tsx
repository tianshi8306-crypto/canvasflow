import { createPortal } from "react-dom";
import type { ReactNode, RefObject, CSSProperties } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";
import type { AnchorMenuRow } from "@/lib/nodeAnchorMenus";

export type AnchorMenuPopoverProps = {
  popRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  menuStyle: CSSProperties | undefined;
  title: string;
  rows: AnchorMenuRow[];
  renderIcon: (row: AnchorMenuRow) => ReactNode;
  onPick: (key: AnchorMenuRow["key"]) => void;
  minWidth?: number;
  maxHeight?: string;
};

/** 锚点菜单 Portal（定位由 anchorMenuPositionStyle 决定） */
export function AnchorMenuPopover({
  popRef,
  open,
  menuStyle,
  title,
  rows,
  renderIcon,
  onPick,
  minWidth = 160,
  maxHeight,
}: AnchorMenuPopoverProps) {
  if (!open || !menuStyle || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popRef}
      className={`nodeAnchorPopover ${RF_NODE_INPUT_CLASS}`}
      role="menu"
      aria-label={title}
      style={{
        ...menuStyle,
        minWidth,
        ...(maxHeight ? { maxHeight, overflowY: "auto" as const } : {}),
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="nodeAnchorPopoverTitle">{title}</div>
      <div className="nodeAnchorPopoverList">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            role="menuitem"
            className="nodeAnchorPopoverRow"
            onClick={() => onPick(row.key)}
          >
            <span className="nodeAnchorPopoverRowIcon">{renderIcon(row)}</span>
            <span className="nodeAnchorPopoverRowLabel">{row.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
