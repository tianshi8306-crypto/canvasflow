export type HermesShellMode = "expanded" | "idle";

/** 灵体在 `.canvasWrap` 内的左上角坐标；x/y < 0 表示首次自动靠右下 */
export type HermesOrbDock = {
  x: number;
  y: number;
};

/** 浮窗在 `.canvasWrap` 内的左上角坐标；x < 0 表示首次打开时自动靠右对齐 */
export type HermesFloatDock = {
  x: number;
  y: number;
};

export type HermesShellPrefs = {
  mode: HermesShellMode;
  panelWidth: number;
  orbDock: HermesOrbDock;
  floatDock: HermesFloatDock;
};

/** 竖版浮窗（约 9:16，加宽加高以提升可读信息量） */
export const HERMES_FLOAT_WIDTH = 300;
export const HERMES_FLOAT_HEIGHT = Math.round((HERMES_FLOAT_WIDTH * 16) / 9);

export const HERMES_FLOAT_DOCK_DEFAULT: HermesFloatDock = { x: -1, y: 72 };

const STORAGE_KEY = "canvasflow.hermesShell.v2";
const STORAGE_KEY_LEGACY = "canvasflow.hermesShell.v1";

export const HERMES_PANEL_WIDTH_DEFAULT = 360;
export const HERMES_PANEL_WIDTH_MIN = 300;
export const HERMES_PANEL_WIDTH_MAX = 480;

export const HERMES_ORB_DOCK_DEFAULT: HermesOrbDock = { x: -1, y: -1 };

function clampFloatDock(dock: Partial<HermesFloatDock> | undefined): HermesFloatDock {
  const x =
    typeof dock?.x === "number" && Number.isFinite(dock.x)
      ? Math.min(4000, Math.max(-1, dock.x))
      : HERMES_FLOAT_DOCK_DEFAULT.x;
  const y =
    typeof dock?.y === "number" && Number.isFinite(dock.y)
      ? Math.min(4000, Math.max(8, dock.y))
      : HERMES_FLOAT_DOCK_DEFAULT.y;
  return { x, y };
}

export function defaultHermesShellPrefs(): HermesShellPrefs {
  return {
    mode: "idle",
    panelWidth: HERMES_PANEL_WIDTH_DEFAULT,
    orbDock: { ...HERMES_ORB_DOCK_DEFAULT },
    floatDock: { ...HERMES_FLOAT_DOCK_DEFAULT },
  };
}

function clampPanelWidth(width: number): number {
  const n = Math.round(width);
  if (!Number.isFinite(n)) return HERMES_PANEL_WIDTH_DEFAULT;
  return Math.min(HERMES_PANEL_WIDTH_MAX, Math.max(HERMES_PANEL_WIDTH_MIN, n));
}

type LegacyOrbDock = Partial<HermesOrbDock> & { right?: number; bottom?: number };

function normalizeOrbDock(dock: LegacyOrbDock | undefined): HermesOrbDock {
  if (typeof dock?.x === "number" && Number.isFinite(dock.x)) {
    const y =
      typeof dock.y === "number" && Number.isFinite(dock.y)
        ? dock.y
        : HERMES_ORB_DOCK_DEFAULT.y;
    return {
      x: Math.min(4000, Math.max(-1, dock.x)),
      y: Math.min(4000, Math.max(-1, y)),
    };
  }
  if (typeof dock?.right === "number" || typeof dock?.bottom === "number") {
    return { x: -1, y: -1 };
  }
  return { ...HERMES_ORB_DOCK_DEFAULT };
}

function parseShellPrefs(raw: string): HermesShellPrefs {
  const parsed = JSON.parse(raw) as Partial<HermesShellPrefs>;
  return {
    mode: parsed.mode === "expanded" ? "expanded" : "idle",
    panelWidth: clampPanelWidth(
      typeof parsed.panelWidth === "number" ? parsed.panelWidth : HERMES_PANEL_WIDTH_DEFAULT,
    ),
    orbDock: normalizeOrbDock(parsed.orbDock as LegacyOrbDock),
    floatDock: clampFloatDock(parsed.floatDock),
  };
}

function loadPersistedShellFields(): Pick<HermesShellPrefs, "panelWidth" | "floatDock"> {
  const base = defaultHermesShellPrefs();
  if (typeof localStorage === "undefined") {
    return { panelWidth: base.panelWidth, floatDock: base.floatDock };
  }
  try {
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) {
      const parsed = JSON.parse(v2) as Partial<HermesShellPrefs>;
      return {
        panelWidth: clampPanelWidth(
          typeof parsed.panelWidth === "number" ? parsed.panelWidth : base.panelWidth,
        ),
        floatDock: clampFloatDock(parsed.floatDock),
      };
    }

    const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacy) {
      const migrated = parseShellPrefs(legacy);
      const fields = {
        panelWidth: migrated.panelWidth,
        floatDock: migrated.floatDock,
      };
      saveHermesShellPrefs({ ...defaultHermesShellPrefs(), ...fields });
      return fields;
    }

    return { panelWidth: base.panelWidth, floatDock: base.floatDock };
  } catch {
    return { panelWidth: base.panelWidth, floatDock: base.floatDock };
  }
}

export function loadHermesShellPrefs(): HermesShellPrefs {
  return hermesSpiritBootPrefs(loadPersistedShellFields());
}

/** 仅持久化面板宽度与浮窗位置；灵体模式与待命坐标每次启动重置 */
export function saveHermesShellPrefs(prefs: HermesShellPrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        panelWidth: clampPanelWidth(prefs.panelWidth),
        floatDock: clampFloatDock(prefs.floatDock),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

/** 每次启动：灵体待命（idle）+ 右下角默认锚点 */
export function hermesSpiritBootPrefs(
  stored: Pick<HermesShellPrefs, "panelWidth" | "floatDock">,
): HermesShellPrefs {
  return {
    mode: "idle",
    panelWidth: clampPanelWidth(stored.panelWidth),
    orbDock: { ...HERMES_ORB_DOCK_DEFAULT },
    floatDock: clampFloatDock(stored.floatDock),
  };
}
