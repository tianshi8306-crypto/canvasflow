/** 与 store 分离，避免 hermesCanvasHighlight ↔ store 循环依赖导致启动黑屏 */
export function hermesHighlightDurationMs(): number {
  if (typeof window !== "undefined") {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return 1200;
      }
    } catch {
      /* jsdom / SSR */
    }
  }
  return 3000;
}
