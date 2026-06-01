import {
  HERMES_FLOAT_HEIGHT,
  HERMES_FLOAT_WIDTH,
  HERMES_ORB_DOCK_DEFAULT,
  type HermesFloatDock,
  type HermesOrbDock,
} from "@/lib/hermes/hermesShellPrefs";

export const HERMES_CANVAS_DOCK_MARGIN = 10;
export const HERMES_ORB_SIZE = 52;
/** 低于此尺寸时不定位/不持久化 dock（避免首帧 52×52 被 clamp 到左上角） */
export const HERMES_CANVAS_WRAP_MIN_W = 320;
export const HERMES_CANVAS_WRAP_MIN_H = 200;
/** 灵体待命：贴右，略高于底栏/小地图留白 */
export const HERMES_ORB_STANDBY_MARGIN_RIGHT = 20;
export const HERMES_ORB_STANDBY_MARGIN_BOTTOM = 80;
export const HERMES_ORB_SUGGEST_GAP = 8;
export const HERMES_ORB_SUGGEST_MAX_WIDTH = 240;
export const HERMES_ORB_SUGGEST_MIN_WIDTH = 120;
/** 首帧布局估算宽（测量前） */
export const HERMES_ORB_SUGGEST_ESTIMATED_WIDTH = 220;
export const HERMES_ORB_SUGGEST_ESTIMATED_HEIGHT = 96;

export type HermesOrbSuggestPlacement = "left" | "right";

export type HermesOrbSuggestPosition = {
  left: number;
  top: number;
  placement: HermesOrbSuggestPlacement;
  maxWidth: number;
};

export function clampOrbDockInWrap(
  x: number,
  y: number,
  wrapW: number,
  wrapH: number,
): HermesOrbDock {
  const m = HERMES_CANVAS_DOCK_MARGIN;
  const maxX = Math.max(m, wrapW - HERMES_ORB_SIZE - m);
  const maxY = Math.max(m, wrapH - HERMES_ORB_SIZE - m);
  return {
    x: Math.min(maxX, Math.max(m, x)),
    y: Math.min(maxY, Math.max(m, y)),
  };
}

export function defaultOrbDockForWrap(wrapW: number, wrapH: number): HermesOrbDock {
  return clampOrbDockInWrap(
    wrapW - HERMES_ORB_SIZE - HERMES_ORB_STANDBY_MARGIN_RIGHT,
    wrapH - HERMES_ORB_SIZE - HERMES_ORB_STANDBY_MARGIN_BOTTOM,
    wrapW,
    wrapH,
  );
}

export function resolveOrbDock(
  stored: HermesOrbDock,
  wrapW: number,
  wrapH: number,
): HermesOrbDock {
  const normalized = normalizeStoredOrbDock(stored, wrapW, wrapH);
  if (normalized.x < 0 || normalized.y < 0) {
    return defaultOrbDockForWrap(wrapW, wrapH);
  }
  return clampOrbDockInWrap(normalized.x, normalized.y, wrapW, wrapH);
}

export function isCanvasWrapMeasurable(wrapW: number, wrapH: number): boolean {
  return wrapW >= HERMES_CANVAS_WRAP_MIN_W && wrapH >= HERMES_CANVAS_WRAP_MIN_H;
}

/** 首帧极小 wrap 会把默认 dock clamp 到 (10,10)，需当作未初始化 */
export function isLikelyMisplacedOrbDock(
  dock: HermesOrbDock,
  wrapW: number,
  wrapH: number,
): boolean {
  if (dock.x < 0 || dock.y < 0) return false;
  if (!isCanvasWrapMeasurable(wrapW, wrapH)) return false;
  const atTopLeft =
    dock.x <= HERMES_CANVAS_DOCK_MARGIN + 4 &&
    dock.y <= HERMES_CANVAS_DOCK_MARGIN + 4;
  if (!atTopLeft) return false;
  const expected = defaultOrbDockForWrap(wrapW, wrapH);
  return expected.x > dock.x + 40 || expected.y > dock.y + 40;
}

export function normalizeStoredOrbDock(
  stored: HermesOrbDock,
  wrapW: number,
  wrapH: number,
): HermesOrbDock {
  if (isLikelyMisplacedOrbDock(stored, wrapW, wrapH)) {
    return { ...HERMES_ORB_DOCK_DEFAULT };
  }
  return stored;
}

export function resolveHermesOrbDisplayPos(
  pos: HermesOrbDock | null,
  stored: HermesOrbDock,
  wrapW: number,
  wrapH: number,
): HermesOrbDock | null {
  if (!isCanvasWrapMeasurable(wrapW, wrapH)) return null;
  if (pos && !isLikelyMisplacedOrbDock(pos, wrapW, wrapH)) {
    return clampOrbDockInWrap(pos.x, pos.y, wrapW, wrapH);
  }
  return resolveOrbDock(stored, wrapW, wrapH);
}

export function resolveHermesFloatDisplayPos(
  pos: HermesFloatDock | null,
  stored: HermesFloatDock,
  wrapW: number,
  wrapH: number,
): HermesFloatDock | null {
  if (!isCanvasWrapMeasurable(wrapW, wrapH)) return null;
  return pos ?? resolveFloatDock(stored, wrapW, wrapH);
}

/** 建议气泡：靠右时显示在灵体左侧，避免溢出画布并遮挡拖拽 */
export function resolveOrbSuggestPosition(
  orbPos: HermesOrbDock,
  wrapW: number,
  wrapH: number,
  popoverWidth = HERMES_ORB_SUGGEST_ESTIMATED_WIDTH,
): HermesOrbSuggestPosition {
  const margin = HERMES_CANVAS_DOCK_MARGIN;
  const gap = HERMES_ORB_SUGGEST_GAP;
  const maxWidth = Math.min(
    HERMES_ORB_SUGGEST_MAX_WIDTH,
    Math.max(HERMES_ORB_SUGGEST_MIN_WIDTH, wrapW - margin * 2),
  );
  const width = Math.min(Math.max(HERMES_ORB_SUGGEST_MIN_WIDTH, popoverWidth), maxWidth);

  const rightAnchor = orbPos.x + HERMES_ORB_SIZE + gap;
  const rightSpace = wrapW - margin - rightAnchor;
  const leftSpace = orbPos.x - margin - gap;

  let placement: HermesOrbSuggestPlacement;
  if (rightSpace >= width) {
    placement = "right";
  } else if (leftSpace >= width) {
    placement = "left";
  } else {
    placement = leftSpace >= rightSpace ? "left" : "right";
  }

  let left =
    placement === "right" ? rightAnchor : orbPos.x - gap - width;
  left = Math.min(Math.max(margin, left), Math.max(margin, wrapW - margin - width));

  const top = Math.min(
    Math.max(margin, orbPos.y - 8),
    Math.max(margin, wrapH - margin - HERMES_ORB_SUGGEST_ESTIMATED_HEIGHT),
  );

  return { left, top, placement, maxWidth: width };
}

export function clampFloatDockInWrap(
  x: number,
  y: number,
  wrapW: number,
  wrapH: number,
): HermesFloatDock {
  const m = HERMES_CANVAS_DOCK_MARGIN;
  const maxX = Math.max(m, wrapW - HERMES_FLOAT_WIDTH - m);
  const maxY = Math.max(m, wrapH - HERMES_FLOAT_HEIGHT - m);
  return {
    x: Math.min(maxX, Math.max(m, x)),
    y: Math.min(maxY, Math.max(m, y)),
  };
}

export function defaultFloatDockForWrap(wrapW: number, wrapH: number): HermesFloatDock {
  return clampFloatDockInWrap(
    wrapW - HERMES_FLOAT_WIDTH - 20,
    Math.max(marginMinY(wrapH), wrapH - HERMES_FLOAT_HEIGHT - 24),
    wrapW,
    wrapH,
  );
}

function marginMinY(wrapH: number): number {
  return Math.min(72, Math.max(HERMES_CANVAS_DOCK_MARGIN, wrapH - HERMES_FLOAT_HEIGHT - 24));
}

export function resolveFloatDock(
  stored: HermesFloatDock,
  wrapW: number,
  wrapH: number,
): HermesFloatDock {
  if (stored.x < 0) {
    return defaultFloatDockForWrap(wrapW, wrapH);
  }
  return clampFloatDockInWrap(stored.x, stored.y, wrapW, wrapH);
}
