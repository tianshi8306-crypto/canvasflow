import { useEffect, useState } from "react";

import { isTauri } from "@tauri-apps/api/core";

import { useProjectStore } from "@/store/projectStore";

import { getAssetById } from "@/shared/api/assets";



/**

 * 解析工程素材预览用相对路径。

 * 节点上已有 `relPath`（如生成刚落盘）时优先使用，避免过期 `assetId` 仍指向首个成片。

 * 仅当无 `relPath` 时，才用 `assetId` 查库。

 */

export function useResolvedAssetRelPath(

  relPath: string | undefined,

  assetId: string | undefined,

): { effectiveRelPath: string | null; loading: boolean } {

  const projectPath = useProjectStore((s) => s.projectPath);

  const pathNow = relPath?.trim() ?? null;



  const [effectiveRelPath, setEffectiveRelPath] = useState<string | null>(pathNow);

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    const p = relPath?.trim();

    const id = assetId?.trim();

    const root = projectPath?.trim();



    if (p) {

      setEffectiveRelPath(p);

      setLoading(false);

      return;

    }



    if (id && root && isTauri()) {

      setLoading(true);

      let cancelled = false;

      void (async () => {

        try {

          const a = await getAssetById(root, id);

          if (cancelled) return;

          setEffectiveRelPath(a?.relPath?.trim() ?? null);

        } catch {

          if (!cancelled) setEffectiveRelPath(null);

        } finally {

          if (!cancelled) setLoading(false);

        }

      })();

      return () => {

        cancelled = true;

      };

    }



    setLoading(false);

    setEffectiveRelPath(null);

  }, [relPath, assetId, projectPath]);



  return { effectiveRelPath, loading };

}

