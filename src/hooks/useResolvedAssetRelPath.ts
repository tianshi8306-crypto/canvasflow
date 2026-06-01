import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useProjectStore } from "@/store/projectStore";
import { getAssetById } from "@/shared/api/assets";

/**
 * 解析工程素材预览用相对路径：优先 `assetId`（DB 权威），否则回退 `relPath`。
 * 若节点上已有 `relPath`（如刚上传），先乐观使用，避免预览空白/失败。
 */
export function useResolvedAssetRelPath(
  relPath: string | undefined,
  assetId: string | undefined,
): { effectiveRelPath: string | null; loading: boolean } {
  const projectPath = useProjectStore((s) => s.projectPath);
  const pathNow = relPath?.trim() ?? null;
  const needsDbLookup = Boolean(assetId?.trim() && projectPath?.trim() && isTauri());

  const [effectiveRelPath, setEffectiveRelPath] = useState<string | null>(pathNow);
  const [loading, setLoading] = useState(() => needsDbLookup && !pathNow);

  useEffect(() => {
    const p = relPath?.trim();
    const id = assetId?.trim();
    const root = projectPath?.trim();

    if (p) setEffectiveRelPath(p);

    if (id && root && isTauri()) {
      if (!p) setLoading(true);
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
