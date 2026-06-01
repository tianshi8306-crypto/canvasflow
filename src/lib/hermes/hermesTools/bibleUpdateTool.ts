import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import type { ProjectBible } from "@/lib/projectBible/projectBible";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { useProjectStore } from "@/store/projectStore";

type BiblePatch = Partial<
  Pick<ProjectBible, "logline" | "visualStyle" | "taboos" | "targetDurationSec">
>;

export function extractBiblePatchFromMessage(text: string): BiblePatch {
  const patch: BiblePatch = {};

  const loglineMatch = text.match(
    /(?:梗概|一句话|logline)(?:改成|改为|：|:)\s*([^，。；\n]+)/i,
  );
  if (loglineMatch?.[1]?.trim()) {
    patch.logline = loglineMatch[1].trim();
  }

  const styleMatch = text.match(
    /(?:视觉风格|整体风格|画风|风格)(?:改成|改为|：|:)\s*([^，。；\n]+)/,
  ) ?? text.match(/画风(?:改成|改为)\s*([^，。；\n]+)/);
  if (styleMatch?.[1]?.trim()) {
    patch.visualStyle = styleMatch[1].trim();
  }

  const tabooMatch = text.match(/(?:禁忌|不要出现|避免)(?:：|:)\s*([^，。；\n]+)/);
  if (tabooMatch?.[1]?.trim()) {
    patch.taboos = tabooMatch[1].trim();
  }

  const durationMatch = text.match(/(?:总时长|全长|目标时长)?\s*(\d+)\s*秒/);
  if (durationMatch?.[1]) {
    const sec = parseInt(durationMatch[1], 10);
    if (sec > 0 && sec <= 3600) {
      patch.targetDurationSec = sec;
    }
  }

  return patch;
}

function biblePatchFromArgs(args: Record<string, unknown> | undefined): BiblePatch {
  const patch: BiblePatch = {};
  if (typeof args?.logline === "string" && args.logline.trim()) {
    patch.logline = args.logline.trim();
  }
  if (typeof args?.visualStyle === "string" && args.visualStyle.trim()) {
    patch.visualStyle = args.visualStyle.trim();
  }
  if (typeof args?.taboos === "string") {
    patch.taboos = args.taboos.trim();
  }
  if (typeof args?.targetDurationSec === "number" && args.targetDurationSec > 0) {
    patch.targetDurationSec = Math.round(args.targetDurationSec);
  }
  return patch;
}

export async function runBibleUpdateTool(
  step: HermesPlanStep,
  opts: { sourceMessage: string },
): Promise<HermesToolRunResult> {
  const projectPath = useProjectStore.getState().projectPath?.trim();
  if (!projectPath) {
    return { ok: false, message: "请先打开工程" };
  }

  const bibleStore = useProjectBibleStore.getState();
  if (bibleStore.projectPath !== projectPath) {
    await bibleStore.loadForProject(projectPath);
  }

  const fromArgs = biblePatchFromArgs(step.args);
  const fromMessage = extractBiblePatchFromMessage(opts.sourceMessage);
  const patch: BiblePatch = { ...fromMessage, ...fromArgs };

  const syncCharacters = step.args?.syncCharacters === true;
  const hasPatch = Object.keys(patch).length > 0;

  if (!hasPatch && !syncCharacters) {
    return {
      ok: false,
      message:
        "请说明要更新的圣经字段（梗概/视觉风格/禁忌/时长），或设置 syncCharacters",
    };
  }

  const updatedFields: string[] = [];
  if (patch.logline !== undefined) updatedFields.push("梗概");
  if (patch.visualStyle !== undefined) updatedFields.push("视觉风格");
  if (patch.taboos !== undefined) updatedFields.push("禁忌");
  if (patch.targetDurationSec !== undefined) updatedFields.push("目标时长");

  if (hasPatch) {
    useProjectBibleStore.getState().patchBible(patch);
    await useProjectBibleStore.getState().flushSave();
  }

  let syncNote = "";
  if (syncCharacters) {
    const { count } = await useProjectBibleStore.getState().syncCharactersFromCanvas();
    syncNote = `，已同步 ${count} 个角色`;
  }

  const message =
    updatedFields.length > 0
      ? `已更新项目圣经：${updatedFields.join("、")}${syncNote}`
      : `已执行圣经同步${syncNote}`;

  useProjectStore.getState().setStatusText(`Hermes：${message}`);
  return { ok: true, message };
}
