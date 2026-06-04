import { appLogger } from "@/lib/appLogger";

/**
 * 安全执行异步 fire-and-forget 调用，捕获错误并静默记录日志。
 *
 * 用于 UI 事件 handler 中不希望抛错导致白屏的场景。
 *
 * @example safeVoid(loadSettings, { config: true })
 * @example safeVoid(() => fetchData(id))
 */
export function safeVoid(
  fn: (() => Promise<unknown>) | (() => unknown),
  context?: string,
): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.catch((err) => {
        appLogger.error(`[safeVoid${context ? ` / ${context}` : ""}]`, err);
      });
    }
  } catch (err) {
    appLogger.error(`[safeVoid${context ? ` / ${context}` : ""}]`, err);
  }
}

/**
 * 创建 AbortController 并返回 signal。
 * 调用方负责在合适时机调用 controller.abort()。
 */
export function createAbortGroup(): {
  controller: AbortController;
  signal: AbortSignal;
} {
  const controller = new AbortController();
  return { controller, signal: controller.signal };
}
