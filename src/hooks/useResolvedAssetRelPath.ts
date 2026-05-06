import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useProjectStore } from "@/store/projectStore";
import { getAssetById } from "@/shared/api/assets";

/**
 * 解析工程素材预览用相对路径：优先 `assetId`（DB 权威），否则回退 `relPath`。
 * 非 Tauri 环境无法按 id 查询，仅使用 `relPath`。
 */
export function useResolvedAssetRelPath(
  relPath: string | undefined,
  assetId: string | undefined,
): { effectiveRelPath: string | null; loading: boolean } {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [effectiveRelPath, setEffectiveRelPath] = useState<string | null>(() => {
    if (assetId?.trim() && isTauri()) return null;
    return relPath?.trim() ?? null;
  });
  const [loading, setLoading] = useState(() => Boolean(assetId?.trim() && isTauri()));

  useEffect(() => {
    const p = relPath?.trim();
    const id = assetId?.trim();
    const root = projectPath?.trim();

    if (id && root && isTauri()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state for async asset lookup
      setLoading(true);
      let cancelled = false;
      void (async () => {
        try {
          const a = await getAssetById(root, id);
          if (cancelled) return;
          const fromDb = a?.relPath?.trim();
          setEffectiveRelPath(fromDb ?? p ?? null);
        } catch {
          if (!cancelled) setEffectiveRelPath(p ?? null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setLoading(false);
    setEffectiveRelPath(p ?? null);
  }, [relPath, assetId, projectPath]);

  return { effectiveRelPath, loading };
}
