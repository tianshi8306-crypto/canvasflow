import { formatUserError } from "@/lib/errors";
import type { StoryboardShot } from "@/lib/types";
import { importMediaFiles } from "@/shared/api/assets";

export function patchStoryboardShotImage(
  shots: StoryboardShot[] | undefined,
  beatId: string,
  patch: Partial<Pick<StoryboardShot, "imagePath" | "imageAssetId">>,
): StoryboardShot[] {
  const list = [...(shots ?? [])];
  const idx = list.findIndex((s) => s.scriptBeatId === beatId);
  const prev =
    idx >= 0 ? list[idx] : ({ scriptBeatId: beatId, visualPrompt: "" } satisfies StoryboardShot);
  const next: StoryboardShot = { ...prev, ...patch, scriptBeatId: beatId };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return list;
}

export async function importStoryboardImageForBeat(
  projectPath: string,
  filePaths: string[],
  shots: StoryboardShot[] | undefined,
  beatId: string,
): Promise<{ shots: StoryboardShot[]; relPath: string } | null> {
  if (!filePaths.length) return null;
  try {
    const imported = await importMediaFiles(projectPath, filePaths.slice(0, 1));
    const item = imported[0];
    if (!item) return null;
    const shotsNext = patchStoryboardShotImage(shots, beatId, {
      imagePath: item.relPath,
      imageAssetId: item.assetId,
    });
    return { shots: shotsNext, relPath: item.relPath };
  } catch (e) {
    throw new Error(formatUserError(e));
  }
}
