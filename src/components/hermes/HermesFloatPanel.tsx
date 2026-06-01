import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HermesSidebar } from "@/components/hermes/HermesSidebar";
import { HermesJobAmbientChip } from "@/components/hermes/HermesJobAmbientChip";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { useHermesJobAmbientSnapshot } from "@/hooks/useHermesJobAmbientSnapshot";
import { readCanvasWrapSize, useCanvasWrapSize } from "@/hooks/useCanvasWrapSize";
import {
  clampFloatDockInWrap,
  isCanvasWrapMeasurable,
  resolveFloatDock,
  resolveHermesFloatDisplayPos,
} from "@/lib/hermes/hermesCanvasDock";
import {
  HERMES_FLOAT_HEIGHT,
  HERMES_FLOAT_WIDTH,
  type HermesFloatDock,
} from "@/lib/hermes/hermesShellPrefs";
import {
  resolveSpiritDisplayName,
} from "@/lib/hermes/agent/hermesSpiritIdentity";
import { useHermesSpiritIdentityStore } from "@/store/hermesSpiritIdentityStore";
import { useShallow } from "zustand/react/shallow";
import {
  IconFloatClose,
  IconFloatExpand,
  IconSpiritDots,
} from "@/components/hermes/HermesWxIcons";

const DRAG_THRESHOLD_PX = 4;

type Props = {
  wrapRef: React.RefObject<HTMLDivElement | null>;
};

export function HermesFloatPanel({ wrapRef }: Props) {
  const hermesMode = useCanvasUiStore((s) => s.hermesMode);
  const storedDock = useCanvasUiStore((s) => s.hermesFloatDock);
  const setHermesFloatDock = useCanvasUiStore((s) => s.setHermesFloatDock);
  const collapseHermes = useCanvasUiStore((s) => s.collapseHermes);
  const projectPath = useProjectStore((s) => s.projectPath);
  const spiritIdentity = useHermesSpiritIdentityStore(
    useShallow((s) => ({
      spiritName: s.spiritName,
      userHonorific: s.userHonorific,
      introShown: s.introShown,
    })),
  );
  const hydrateSpirit = useHermesSpiritIdentityStore((s) => s.hydrate);
  const spiritLabel = resolveSpiritDisplayName(spiritIdentity);
  useEffect(() => {
    void hydrateSpirit(projectPath);
  }, [hydrateSpirit, projectPath]);
  const jobAmbient = useHermesJobAmbientSnapshot(projectPath);

  const [pos, setPos] = useState<HermesFloatDock | null>(null);
  const { w: wrapW, h: wrapH } = useCanvasWrapSize(wrapRef, hermesMode === "expanded");
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
    latest?: HermesFloatDock;
  } | null>(null);

  const layoutSize = useMemo(() => {
    if (isCanvasWrapMeasurable(wrapW, wrapH)) return { w: wrapW, h: wrapH };
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const measured = readCanvasWrapSize(wrap);
    return isCanvasWrapMeasurable(measured.w, measured.h) ? measured : null;
  }, [wrapH, wrapRef, wrapW]);

  const displayPos = useMemo(() => {
    if (hermesMode !== "expanded" || !layoutSize) return null;
    return resolveHermesFloatDisplayPos(pos, storedDock, layoutSize.w, layoutSize.h);
  }, [hermesMode, layoutSize, pos, storedDock]);

  useLayoutEffect(() => {
    if (hermesMode !== "expanded") {
      setPos(null);
      return;
    }
    if (!layoutSize) return;

    const next = resolveFloatDock(storedDock, layoutSize.w, layoutSize.h);
    setPos(next);
    if (storedDock.x < 0) {
      setHermesFloatDock(next);
    }
  }, [hermesMode, layoutSize, setHermesFloatDock, storedDock.x, storedDock.y]);

  useLayoutEffect(() => {
    if (hermesMode !== "expanded" || !layoutSize) return;

    const wrap = wrapRef.current;
    if (!wrap) return;

    const ro = new ResizeObserver(() => {
      setPos((prev) => {
        if (!prev) return prev;
        const clamped = clampFloatDockInWrap(
          prev.x,
          prev.y,
          layoutSize.w,
          layoutSize.h,
        );
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          setHermesFloatDock(clamped);
        }
        return clamped;
      });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [hermesMode, layoutSize, setHermesFloatDock, wrapRef]);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || !displayPos) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: displayPos.x,
        startTop: displayPos.y,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.stopPropagation();
    },
    [displayPos],
  );

  const onHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId || !layoutSize) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      const next = clampFloatDockInWrap(
        drag.startLeft + dx,
        drag.startTop + dy,
        layoutSize.w,
        layoutSize.h,
      );
      drag.latest = next;
      setPos(next);
      e.stopPropagation();
    },
    [layoutSize],
  );

  const onHeaderPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (drag.moved && drag.latest) {
        setHermesFloatDock(drag.latest);
      }
      e.stopPropagation();
    },
    [setHermesFloatDock],
  );

  useEffect(() => {
    if (hermesMode !== "expanded") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      collapseHermes();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapseHermes, hermesMode]);

  if (hermesMode !== "expanded" || !displayPos) return null;

  return (
    <div
      className="hermesFloatShell"
      style={{
        left: displayPos.x,
        top: displayPos.y,
        width: HERMES_FLOAT_WIDTH,
        height: HERMES_FLOAT_HEIGHT,
      }}
      role="dialog"
      aria-label={`${spiritLabel} 对话`}
      onWheel={(e) => e.stopPropagation()}
    >
      <header
        className="hermesFloatHeader"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="hermesFloatHeaderLead">
          <span className="hermesFloatHeaderMark" aria-hidden>
            <IconSpiritDots />
          </span>
          {jobAmbient.hasActive ? (
            <HermesJobAmbientChip
              summary={jobAmbient.summary}
              failed={jobAmbient.failed > 0}
              stopPropagation
            />
          ) : null}
        </div>
        <div className="hermesFloatHeaderActions">
          <button
            type="button"
            className="hermesFloatHeaderBtn"
            title="放大（敬请期待）"
            aria-label="放大窗口"
            disabled
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconFloatExpand />
          </button>
          <button
            type="button"
            className="hermesFloatHeaderBtn"
            title="收起为灵体"
            aria-label={`关闭 ${spiritLabel}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={collapseHermes}
          >
            <IconFloatClose />
          </button>
        </div>
      </header>
      <div className="hermesFloatBody">
        <HermesSidebar layout="float" />
      </div>
    </div>
  );
}
