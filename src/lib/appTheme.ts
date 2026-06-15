import { isTauri } from "@tauri-apps/api/core";

export type AppTheme = "dark" | "light";

export const APP_THEME_CANVAS_BG: Record<AppTheme, string> = {
  dark: "#121212",
  light: "#e8e8e8",
};

/** 将历史/导入设置中的主题值规范为 dark | light */
export function normalizeAppTheme(raw: string | undefined | null): AppTheme {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "dark") return "dark";
  if (v === "light" || v === "day" || v === "dawn" || v === "dusk") return "light";
  return "dark";
}

/** 应用全应用主题：DOM token + 原生窗口（Tauri） */
export function applyAppTheme(theme: AppTheme): void {
  const normalized = normalizeAppTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = normalized;
  root.style.colorScheme = normalized;

  if (typeof document.body !== "undefined") {
    document.body.style.backgroundColor = APP_THEME_CANVAS_BG[normalized];
  }

  if (!isTauri()) return;

  void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
    const win = getCurrentWindow();
    void win.setTheme(normalized);
    const bg = APP_THEME_CANVAS_BG[normalized];
    const winWithBg = win as typeof win & {
      setBackgroundColor?: (color: string) => Promise<void>;
    };
    if (typeof winWithBg.setBackgroundColor === "function") {
      void winWithBg.setBackgroundColor(bg);
    }
  });
}
