import { useEffect, useRef } from "react";

/**
 * Hook: 在组件挂载时创建 AbortController，卸载时自动 abort。
 * 返回 AbortSignal，用于传给 fetch 或其他可取消 API。
 */
export function useAbortSignal(): AbortSignal {
  const controllerRef = useRef<AbortController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new AbortController();
  }
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);
  return controllerRef.current.signal;
}
