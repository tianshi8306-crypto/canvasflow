import { useCallback, useState } from "react";

const STORAGE_KEY = "canvasflow.showAssetIds";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 是否在素材列表/图库中展示 `assetId`（写入 localStorage，默认关闭）。
 */
export function useAssetIdVisibilityPreference(): [boolean, (next: boolean) => void] {
  const [show, setShow] = useState(readStored);

  const setPersisted = useCallback((next: boolean) => {
    setShow(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return [show, setPersisted];
}
