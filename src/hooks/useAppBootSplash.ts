import { useEffect } from "react";

const SPLASH_ID = "app-boot-splash";
const EXIT_CLASS = "app-boot-splash--exiting";
const MIN_VISIBLE_MS = 480;
const MAX_WAIT_CANVAS_MS = 5000;
const EXIT_ANIM_MS = 450;

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitForCanvasPane(): Promise<void> {
  if (document.querySelector(".react-flow__pane")) return Promise.resolve();

  return new Promise((resolve) => {
    const deadline = performance.now() + MAX_WAIT_CANVAS_MS;
    const tick = () => {
      if (document.querySelector(".react-flow__pane") || performance.now() >= deadline) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function dismissSplashElement(): void {
  const el = document.getElementById(SPLASH_ID);
  if (!el || el.classList.contains(EXIT_CLASS)) return;
  el.classList.add(EXIT_CLASS);
  window.setTimeout(() => el.remove(), EXIT_ANIM_MS + 40);
}

/**
 * 首屏启动层：等字体、画布挂载与最短展示时间后淡出，避免白画布 + 黑标题栏闪屏。
 */
export function useAppBootSplash(): void {
  useEffect(() => {
    let cancelled = false;
    const started = performance.now();

    void (async () => {
      try {
        await document.fonts?.ready;
      } catch {
        /* ignore */
      }
      if (cancelled) return;

      await waitForPaint();
      if (cancelled) return;

      await waitForCanvasPane();
      if (cancelled) return;

      const remain = MIN_VISIBLE_MS - (performance.now() - started);
      if (remain > 0) {
        await new Promise<void>((r) => window.setTimeout(r, remain));
      }
      if (cancelled) return;

      dismissSplashElement();
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
