import type { ReactNode } from "react";
import type { AnchorMenuRow } from "@/lib/nodeAnchorMenus";
import { renderCanvasMenuNodeIcon } from "@/components/canvas/canvasMenuNodeIcons";

export function defaultAnchorMenuIcon(row: AnchorMenuRow): ReactNode {
  return renderCanvasMenuNodeIcon(row.key);
}

export function simpleAnchorMenuIcon(row: AnchorMenuRow): ReactNode {
  return renderCanvasMenuNodeIcon(row.key);
}
