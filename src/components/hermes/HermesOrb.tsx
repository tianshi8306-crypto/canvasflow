import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HermesOrbSuggestionPopover } from "@/components/hermes/HermesOrbSuggestionPopover";
import { HermesOrbProgressPeek } from "@/components/hermes/HermesOrbProgressPeek";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useHermesOrbSuggestStore } from "@/store/hermesOrbSuggestStore";
import { useHermesShellActivityStore } from "@/store/hermesShellActivityStore";
import {
  resolveSpiritDisplayName,
  resolveSpiritShortMark,
} from "@/lib/hermes/agent/hermesSpiritIdentity";
import { formatHermesOrbJobTitle } from "@/lib/hermes/agent/hermesJobAmbient";
import {
  pickHermesOrbRecentTaskLines,
  resolveHermesOrbActivity,
} from "@/lib/hermes/agent/hermesOrbActivity";
import { useHermesJobStore } from "@/lib/hermes/agent/hermesJobStore";
import {
  clampOrbDockInWrap,
  HERMES_ORB_SIZE,
  isCanvasWrapMeasurable,
  isLikelyMisplacedOrbDock,
  normalizeStoredOrbDock,
  resolveHermesOrbDisplayPos,
} from "@/lib/hermes/hermesCanvasDock";
import { setPendingOrbPlanOrigin } from "@/lib/hermes/hermesOrbProactiveAct";
import type { HermesOrbDock } from "@/lib/hermes/hermesShellPrefs";
import { useHermesJobAmbientSnapshot } from "@/hooks/useHermesJobAmbientSnapshot";
import { readCanvasWrapSize, useCanvasWrapSize } from "@/hooks/useCanvasWrapSize";
import { useProjectStore } from "@/store/projectStore";
import { countFailed, countRunning } from "@/lib/hermes/hermesTaskTrack";
import { useHermesTaskStore } from "@/store/hermesTaskStore";
import { useHermesSpiritIdentityStore } from "@/store/hermesSpiritIdentityStore";
import { useShallow } from "zustand/react/shallow";

const DRAG_THRESHOLD_PX = 4;
const PEEK_HIDE_DELAY_MS = 140;

type Props = {
  wrapRef: React.RefObject<HTMLDivElement | null>;
};

export function HermesOrb({ wrapRef }: Props) {
  const storedDock = useCanvasUiStore((s) => s.hermesOrbDock);
  const setHermesOrbDock = useCanvasUiStore((s) => s.setHermesOrbDock);
  const expandHermes = useCanvasUiStore((s) => s.expandHermes);
  const expandHermesWithPrompt = useCanvasUiStore((s) => s.expandHermesWithPrompt);
  const openHermesJobDrawer = useCanvasUiStore((s) => s.openHermesJobDrawer);
  const projectPath = useProjectStore((s) => s.projectPath);
  const spiritIdentity = useHermesSpiritIdentityStore(
    useShallow((s) => ({
      spiritName: s.spiritName,
      userHonorific: s.userHonorific,
      introShown: s.introShown,
    })),
  );
  const hydrateSpirit = useHermesSpiritIdentityStore((s) => s.hydrate);
  const spiritMark = resolveSpiritShortMark(spiritIdentity);
  const spiritLabel = resolveSpiritDisplayName(spiritIdentity);
  useEffect(() => {
    void hydrateSpirit(projectPath);
  }, [hydrateSpirit, projectPath]);
  const jobs = useHermesJobStore((s) => s.jobs);
  const tasks = useHermesTaskStore((s) => s.tasks);
  const jobAmbient = useHermesJobAmbientSnapshot(projectPath);
  const planning = useHermesShellActivityStore((s) => s.planning);
  const streaming = useHermesShellActivityStore((s) => s.streaming);
  const running = useMemo(() => countRunning(tasks), [tasks]);
  const failed = useMemo(() => countFailed(tasks), [tasks]);
  const suggestion = useHermesOrbSuggestStore((s) => s.suggestion);
  const dismissCurrent = useHermesOrbSuggestStore((s) => s.dismissCurrent);

  const activity = useMemo(
    () =>
      resolveHermesOrbActivity({
        planning,
        streaming,
        snapshot: jobAmbient,
        backgroundFailed: failed,
      }),
    [failed, jobAmbient, planning, streaming],
  );

  const recentLines = useMemo(
    () => pickHermesOrbRecentTaskLines(jobs, tasks, projectPath, 2),
    [jobs, projectPath, tasks],
  );

  const orbAttention = activity !== "idle" || Boolean(suggestion);

  const { w: wrapW, h: wrapH } = useCanvasWrapSize(wrapRef, true);
  const [pos, setPos] = useState<HermesOrbDock | null>(null);
  const [hoverPeekOpen, setHoverPeekOpen] = useState(false);
  const [orbPointerActive, setOrbPointerActive] = useState(false);
  const peekHideTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
    latest?: HermesOrbDock;
  } | null>(null);

  const layoutSize = useMemo(() => {
    if (isCanvasWrapMeasurable(wrapW, wrapH)) return { w: wrapW, h: wrapH };
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const measured = readCanvasWrapSize(wrap);
    return isCanvasWrapMeasurable(measured.w, measured.h) ? measured : null;
  }, [wrapH, wrapRef, wrapW]);

  const displayPos = useMemo(() => {
    if (!layoutSize) return null;
    return resolveHermesOrbDisplayPos(pos, storedDock, layoutSize.w, layoutSize.h);
  }, [layoutSize, pos, storedDock]);

  const clearPeekHideTimer = useCallback(() => {
    if (peekHideTimerRef.current != null) {
      window.clearTimeout(peekHideTimerRef.current);
      peekHideTimerRef.current = null;
    }
  }, []);

  const schedulePeekHide = useCallback(() => {
    if (activity === "failed") return;
    clearPeekHideTimer();
    peekHideTimerRef.current = window.setTimeout(() => {
      setHoverPeekOpen(false);
      peekHideTimerRef.current = null;
    }, PEEK_HIDE_DELAY_MS);
  }, [activity, clearPeekHideTimer]);

  const showPeek = useCallback(() => {
    clearPeekHideTimer();
    setHoverPeekOpen(true);
  }, [clearPeekHideTimer]);

  useLayoutEffect(() => {
    if (!layoutSize || dragRef.current) return;

    const current = useCanvasUiStore.getState().hermesOrbDock;
    const normalized = normalizeStoredOrbDock(current, layoutSize.w, layoutSize.h);
    const next = resolveHermesOrbDisplayPos(null, normalized, layoutSize.w, layoutSize.h);
    if (!next) return;

    setPos(next);
    if (
      isLikelyMisplacedOrbDock(current, layoutSize.w, layoutSize.h) ||
      normalized.x < 0 ||
      normalized.y < 0 ||
      next.x !== current.x ||
      next.y !== current.y
    ) {
      setHermesOrbDock(next);
    }
  }, [layoutSize, setHermesOrbDock, storedDock.x, storedDock.y]);

  useLayoutEffect(
    () => () => clearPeekHideTimer(),
    [clearPeekHideTimer],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || !displayPos || !layoutSize) return;
      setOrbPointerActive(true);
      setHoverPeekOpen(false);
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
    [displayPos, layoutSize],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId || !layoutSize) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      setHoverPeekOpen(false);
      const next = clampOrbDockInWrap(
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

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setOrbPointerActive(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (drag.moved && drag.latest) {
        setHermesOrbDock(drag.latest);
        setPos(drag.latest);
      } else if (!drag.moved) {
        expandHermes();
      }
      e.stopPropagation();
    },
    [expandHermes, setHermesOrbDock],
  );

  const handleSuggestAction = useCallback(() => {
    if (!suggestion) return;
    setPendingOrbPlanOrigin(suggestion.id);
    dismissCurrent();
    expandHermesWithPrompt(suggestion.actionPrompt);
  }, [dismissCurrent, expandHermesWithPrompt, suggestion]);

  const handleOpenDetails = useCallback(() => {
    openHermesJobDrawer();
  }, [openHermesJobDrawer]);

  if (!displayPos || !layoutSize) return null;

  const showFailedPinnedPeek =
    activity === "failed" && !suggestion && !orbPointerActive;
  const showHoverProgressPeek =
    hoverPeekOpen &&
    (activity === "planning" || activity === "running") &&
    !suggestion &&
    !orbPointerActive;
  const showProgressPeek = showFailedPinnedPeek || showHoverProgressPeek;

  const orbTitle = suggestion
    ? suggestion.message
    : formatHermesOrbJobTitle(jobAmbient, spiritMark) ??
      (activity === "failed"
        ? `${spiritLabel} · 任务失败，悬停或点「看详情」`
        : activity === "planning"
          ? `${spiritLabel} · 正在规划步骤`
          : activity === "running"
            ? `${spiritLabel} · ${jobAmbient.summary || "制片进行中"}`
            : running > 0
              ? `${spiritLabel} · ${running} 个任务进行中`
              : `${spiritLabel} · 点击展开，拖拽移动`);

  const orbClass = [
    "hermesOrb",
    "nopan",
    "nodrag",
    "nowheel",
    orbAttention ? "hermesOrb--attention" : "",
    activity === "planning" ? "hermesOrb--planning" : "",
    activity === "running" ? "hermesOrb--running" : "",
    activity === "failed" ? "hermesOrb--failed hermesOrb--failedPulse" : "",
    suggestion ? "hermesOrb--suggest" : "",
    orbPointerActive ? "hermesOrb--dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {suggestion ? (
        <HermesOrbSuggestionPopover
          orbPos={displayPos}
          wrapW={layoutSize.w}
          wrapH={layoutSize.h}
          suggestion={suggestion}
          onAction={handleSuggestAction}
          onDismiss={dismissCurrent}
        />
      ) : null}
      {showProgressPeek ? (
        <HermesOrbProgressPeek
          orbPos={displayPos}
          wrapW={layoutSize.w}
          wrapH={layoutSize.h}
          activity={activity}
          lines={
            recentLines.length > 0
              ? recentLines
              : activity === "planning"
                ? ["正在分析指令与画布状态…"]
                : []
          }
          pinned={showFailedPinnedPeek}
          onOpenDetails={handleOpenDetails}
          onOpenChat={expandHermes}
          onMouseEnter={showPeek}
          onMouseLeave={schedulePeekHide}
        />
      ) : null}
      <button
        type="button"
        className={orbClass}
        style={{
          left: displayPos.x,
          top: displayPos.y,
          width: HERMES_ORB_SIZE,
          height: HERMES_ORB_SIZE,
        }}
        aria-label={`打开 ${spiritLabel}`}
        title={orbTitle}
        onMouseEnter={showPeek}
        onMouseLeave={schedulePeekHide}
        onFocus={showPeek}
        onBlur={schedulePeekHide}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="hermesOrbGlow" aria-hidden />
        {orbAttention ? <span className="hermesOrbBadge" aria-hidden /> : null}
        <span className="hermesOrbFace" aria-hidden>
          <span className="hermesOrbEye" />
          <span className="hermesOrbEye" />
        </span>
      </button>
    </>
  );
}
