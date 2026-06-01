import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { GEN_PANEL_CHROME_MENU_Z } from "@/hooks/useNodeGenerationChrome";
import { getNodeChromePortalContainer } from "@/lib/canvasNodeChromePortal";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { viewportDeltaToLocal } from "@/lib/nodeChromeLocalCoords";

type MenuPos = {
  top: number;
  left: number;
  inNode: boolean;
};

type Props = {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement>;
  menuRef?: RefObject<HTMLDivElement>;
  className: string;
  children: ReactNode;
  zIndex?: number;
};

/** 预览顶栏下拉：Portal，优先挂节点内层避免 overflow / 叠层错位 */
export function PreviewToolbarMenuPortal({
  open,
  triggerRef,
  menuRef,
  className,
  children,
  zIndex = GEN_PANEL_CHROME_MENU_Z,
}: Props) {
  const chromeMount = useNodeChromeMount();
  const [pos, setPos] = useState<MenuPos | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const sync = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mount = chromeMount?.mountRef.current;
      if (chromeMount && mount) {
        const mountRect = mount.getBoundingClientRect();
        const invZoom = chromeMount.invZoom;
        setPos({
          top: viewportDeltaToLocal(rect.bottom - mountRect.top, invZoom) + 4,
          left: viewportDeltaToLocal(rect.left - mountRect.left, invZoom),
          inNode: true,
        });
      } else {
        setPos({ top: rect.bottom + 4, left: rect.left, inNode: false });
      }
    };
    sync();
    let raf = 0;
    const tick = () => {
      sync();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chromeMount, open, triggerRef]);

  const inNodeLayer = Boolean(chromeMount && pos?.inNode);
  const mountEl = inNodeLayer
    ? chromeMount!.mountRef.current
    : getNodeChromePortalContainer();
  const invZoom = chromeMount?.invZoom ?? 1;

  if (!open || !pos || typeof document === "undefined") return null;
  if (!mountEl) return null;

  if (inNodeLayer) {
    return createPortal(
      <div
        style={{
          position: "absolute",
          top: pos.top,
          left: pos.left,
          zIndex,
        }}
      >
        <div
          ref={menuRef}
          className={`nodeChrome-portalScale ${className}`}
          style={{
            transform: `scale(${invZoom})`,
            transformOrigin: "top left",
          }}
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>,
      mountEl,
    );
  }

  return createPortal(
    <div
      ref={menuRef}
      className={className}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex,
      }}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    mountEl,
  );
}
