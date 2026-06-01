import { useEffect, useMemo, useState } from "react";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";
import { resolveAssetRelPath } from "@/shared/api/assets";
import { probeSeedanceImageRef } from "@/lib/seedance/probeSeedanceImageRef";
import type { SeedanceImageComplianceResult } from "@/lib/seedance/seedanceImageCompliance";
import { useProjectStore } from "@/store/projectStore";

const PENDING: SeedanceImageComplianceResult = {
  status: "pending",
  pass: false,
  errors: [],
  warnings: [],
  meta: {},
};

function refComplianceKey(item: VideoIncomingRefItem): string {
  return `${item.edgeId}:${item.assetId ?? ""}:${item.path}`;
}

/**
 * 上游图片参考 → Seedance 2.0 合规结果（按 edgeId 索引）。
 * 用于参考条与 prompt chip 共用蓝勾 / 警告 badge。
 */
export function useSeedanceImageComplianceMap(
  items: VideoIncomingRefItem[],
): Map<string, SeedanceImageComplianceResult> {
  const projectPath = useProjectStore((s) => s.projectPath);
  const imageItems = useMemo(
    () => items.filter((i) => i.kind === "image" && (i.path?.trim() || i.assetId?.trim())),
    [items],
  );

  const [byKey, setByKey] = useState<Record<string, SeedanceImageComplianceResult>>({});

  const keys = useMemo(
    () => imageItems.map((item) => refComplianceKey(item)).join("|"),
    [imageItems],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const next: Record<string, SeedanceImageComplianceResult> = {};
      for (const item of imageItems) {
        const key = refComplianceKey(item);
        next[key] = PENDING;
      }
      setByKey(next);

      for (const item of imageItems) {
        const key = refComplianceKey(item);
        const relPath =
          (await resolveAssetRelPath(projectPath, item.path, item.assetId))?.trim() ||
          item.path?.trim() ||
          "";
        const result = await probeSeedanceImageRef({ projectPath, relPath });
        if (cancelled) return;
        setByKey((prev) => ({ ...prev, [key]: result }));
      }
    };

    if (imageItems.length === 0) {
      setByKey({});
      return;
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [imageItems, keys, projectPath]);

  return useMemo(() => {
    const map = new Map<string, SeedanceImageComplianceResult>();
    for (const item of imageItems) {
      const key = refComplianceKey(item);
      map.set(item.edgeId, byKey[key] ?? PENDING);
    }
    return map;
  }, [byKey, imageItems]);
}
