import { useEffect } from "react";

const SPLASH_ID = "app-boot-splash";
const EXIT_CLASS = "app-boot-splash--exiting";
/** 启动动画最短可见时间，确保用户感知到加载正在进行 */
const MIN_VISIBLE_MS = 1800;
/** 等待 App 首屏渲染完成的绝对安全超时 */
const MAX_WAIT_INIT_MS = 10000;
const EXIT_ANIM_MS = 450;

/**
 * 首屏启动层：启动动画的 CSS 已内联在 index.html 中，随 HTML 立即生效。
 * 此 Hook 仅在 App 挂载且 React 初始化完成后，在动画已展示足够时长时淡出。
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

      // 等 React 初始渲染（含所有子 effect）完成
      await new Promise<void>((r) => {
        const deadline = started + MAX_WAIT_INIT_MS;
        const tick = () => {
          const el = document.querySelector(".react-flow__pane");
          if (el || performance.now() >= deadline) {
            r();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      if (cancelled) return;

      // 确保动画展示足够久
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

function dismissSplashElement(): void {
  const el = document.getElementById(SPLASH_ID);
  if (!el || el.classList.contains(EXIT_CLASS)) return;
  el.classList.add(EXIT_CLASS);
  window.setTimeout(() => el.remove(), EXIT_ANIM_MS + 40);
}
