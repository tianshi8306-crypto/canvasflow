import { invoke, isTauri } from "@tauri-apps/api/core";
import { resolveAssetRelPath } from "@/shared/api/assets";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import {
  evaluateSeedanceImageCompliance,
  normalizeImageFormatExt,
  type SeedanceImageComplianceResult,
} from "@/lib/seedance/seedanceImageCompliance";

export type ProjectRelImageProbe = {
  width: number;
  height: number;
  sizeBytes: number;
  ext: string;
};

/** Tauri：读取工程内图片宽高与文件大小 */
export async function probeProjectRelImage(
  projectPath: string,
  relPath: string,
): Promise<ProjectRelImageProbe | null> {
  if (!isTauri() || !projectPath.trim() || !relPath.trim()) return null;
  try {
    return await invoke<ProjectRelImageProbe>("probe_project_rel_image", {
      projectPath: projectPath.trim(),
      relPath: relPath.trim(),
    });
  } catch {
    return null;
  }
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export type ProbeSeedanceImageRefInput = {
  projectPath: string | null | undefined;
  relPath: string;
};

/** 对单张上游参考图执行 Seedance 合规探测 + 评估 */
export async function probeSeedanceImageRef(
  input: ProbeSeedanceImageRefInput,
): Promise<SeedanceImageComplianceResult> {
  const relPath = input.relPath?.trim();
  if (!relPath) {
    return evaluateSeedanceImageCompliance({});
  }

  const format = normalizeImageFormatExt(relPath);

  if (isTauri() && input.projectPath?.trim()) {
    const probed = await probeProjectRelImage(input.projectPath, relPath);
    if (probed) {
      return evaluateSeedanceImageCompliance({
        format: probed.ext || format,
        width: probed.width,
        height: probed.height,
        sizeBytes: probed.sizeBytes,
      });
    }
  }

  const src = input.projectPath?.trim()
    ? resolveProjectAssetSrc(input.projectPath, relPath)
    : null;
  if (src) {
    const dim = await loadImageDimensions(src);
    if (dim) {
      return evaluateSeedanceImageCompliance({
        format,
        width: dim.width,
        height: dim.height,
      });
    }
  }

  return evaluateSeedanceImageCompliance({ format });
}

export type SeedanceComplianceRefItem = {
  edgeId: string;
  kind: string;
  path?: string;
  assetId?: string;
};

/** 批量探测参考图合规（生成提交前静默等待用） */
export async function probeSeedanceImageComplianceForRefs(
  projectPath: string | null | undefined,
  items: SeedanceComplianceRefItem[],
): Promise<Map<string, SeedanceImageComplianceResult>> {
  const map = new Map<string, SeedanceImageComplianceResult>();
  for (const item of items) {
    if (item.kind !== "image") continue;
    const relPath =
      (await resolveAssetRelPath(projectPath, item.path, item.assetId))?.trim() ||
      item.path?.trim() ||
      "";
    map.set(item.edgeId, await probeSeedanceImageRef({ projectPath, relPath }));
  }
  return map;
}
