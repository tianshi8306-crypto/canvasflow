/**
 * 轻量应用日志：生产环境也保留 warn/error，便于排查；info/debug 仅在开发输出。
 */
const prefix = "[CanvasFlow]";

export const appLogger = {
  debug: (message: string, ...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.debug(prefix, message, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.info(prefix, message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(prefix, message, ...args);
  },
  error: (message: string, error?: unknown, ...args: unknown[]) => {
    console.error(prefix, message, error ?? "", ...args);
  },
};
