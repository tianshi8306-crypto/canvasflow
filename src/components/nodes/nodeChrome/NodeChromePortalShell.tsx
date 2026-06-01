import { type MutableRefObject, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  GEN_PANEL_CHROME_Z,
  type GenPanelPlacement,
  type GenPanelPos,
} from "@/hooks/useNodeGenerationChrome";
import { getNodeChromePortalContainer } from "@/lib/canvasNodeChromePortal";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";

type Props = {
  active: boolean;
  pos: GenPanelPos | null;
  panelRef?: RefObject<HTMLDivElement | null>;
  setPanelRef?: (el: HTMLDivElement | null) => void;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
};

/** 节点顶/底栏 Portal 壳：优先挂到 NodeChromeProvider，与预览同层；无 Provider 时回退画布根 */
export function NodeChromePortalShell({
  active,
  pos,
  panelRef,
  setPanelRef,
  className,
  style,
  children,
  onPointerDown,
  onClick,
}: Props) {
  const chromeMount = useNodeChromeMount();
  const inNodeLayer = Boolean(chromeMount);
  const mountEl = inNodeLayer
    ? chromeMount!.mountRef.current
    : getNodeChromePortalContainer();
  const invZoom = chromeMount?.invZoom ?? 1;

  if (!active || !pos || typeof document === "undefined") return null;
  if (!mountEl) return null;

  const placement: GenPanelPlacement = pos.placement;
  const origin = placement === "above" ? "bottom center" : "top center";
  const anchorTransform =
    placement === "above" ? "translate(-50%, -100%)" : "translateX(-50%)";

  const assignRef = (el: HTMLDivElement | null) => {
    if (panelRef) {
      (panelRef as MutableRefObject<HTMLDivElement | null>).current = el;
    }
    setPanelRef?.(el);
  };

  if (inNodeLayer) {
    const scaledClass = ["nodeChrome-portalScale", className].filter(Boolean).join(" ");
    return createPortal(
      <div
        style={{
          position: "absolute",
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          transform: anchorTransform,
          zIndex: GEN_PANEL_CHROME_Z,
        }}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <div
          ref={assignRef}
          className={scaledClass}
          style={{
            transform: `scale(${invZoom})`,
            transformOrigin: origin,
            ...style,
          }}
        >
          {children}
        </div>
      </div>,
      mountEl,
    );
  }

  return createPortal(
    <div
      ref={assignRef}
      className={className}
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: anchorTransform,
        zIndex: GEN_PANEL_CHROME_Z,
        ...style,
      }}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {children}
    </div>,
    mountEl,
  );
}
