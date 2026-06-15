import type { ScriptBeat, ScriptRole } from "@/lib/types";

/** 与持久化 JSON 对齐的默认空字段（不含 id） */
export const SCRIPT_BEAT_EMPTY_FIELDS: Omit<ScriptBeat, "id"> = {
  shotNumber: "",
  durationHint: "",
  description: "",
  characters: [],
  emotion: "",
  sceneTags: "",
  dialogue: "",
  sceneHeading: "",
  episodeSceneShot: "",
  shotSize: "",
  cameraMove: "",
  cameraAngle: "",
  soundHint: "",
  editFocus: "",
  rhythmTag: "",
  storyboardBlock: "",
  isReactionShot: false,
  dialogueType: "",
  performanceNote: "",
  bgmHint: "",
  storyboardPrompt: "",
  videoMotionPrompt: "",
  // ── 以下字段已废弃，保留默认值仅用于旧工程兼容 ──
  scene: "",
  character1: "",
  character1Desc: "",
  character1Image: "",
  character2: "",
  character2Desc: "",
  character2Image: "",
  reference: "",
  characterAction: "",
  lightingMood: "",
  soundEffect: "",
};

export function emptyScriptBeat(): ScriptBeat {
  return { id: crypto.randomUUID(), ...SCRIPT_BEAT_EMPTY_FIELDS };
}

type LegacyBeat = Partial<ScriptBeat> & { id: string; shot?: string };

function normalizeRoles(input: LegacyBeat): ScriptRole[] {
  const out: ScriptRole[] = [];
  const src = Array.isArray(input.characters) ? input.characters : [];
  for (const r of src) {
    const name = (r?.name ?? "").toString().trim();
    const desc = (r?.description ?? "").toString();
    if (!name && !desc) continue;
    out.push({
      id: (r?.id ?? crypto.randomUUID()).toString(),
      name,
      description: desc,
      imagePath: (r?.imagePath ?? "").toString(),
      reference: (r?.reference ?? "").toString(),
      action: (r?.action ?? "").toString(),
      emotion: (r?.emotion ?? "").toString(),
      lines: (r?.lines ?? "").toString(),
    });
  }
  return out;
}

/** 合并旧数据：仅提取有效字段，废弃字段统一为空 */
export function normalizeScriptBeat(input: LegacyBeat): ScriptBeat {
  return {
    ...SCRIPT_BEAT_EMPTY_FIELDS,
    id: input.id,
    shotId: (input.shotId ?? input.id).toString(),
    timeIn: typeof input.timeIn === "number" ? input.timeIn : undefined,
    timeOut: typeof input.timeOut === "number" ? input.timeOut : undefined,
    shotNumber: (input.shotNumber ?? "").toString(),
    durationHint: (input.durationHint ?? "").toString(),
    description: (input.description ?? "").toString(),
    characters: normalizeRoles(input),
    emotion: (input.emotion ?? "").toString(),
    sceneTags: (input.sceneTags ?? "").toString(),
    dialogue: (input.dialogue ?? "").toString(),
    sceneHeading: (input.sceneHeading ?? "").toString(),
    episodeSceneShot: (input.episodeSceneShot ?? "").toString(),
    shotSize: (input.shotSize ?? "").toString(),
    cameraMove: (input.cameraMove ?? "").toString(),
    cameraAngle: (input.cameraAngle ?? "").toString(),
    soundHint: (input.soundHint ?? "").toString(),
    editFocus: (input.editFocus ?? "").toString(),
    rhythmTag: (input.rhythmTag ?? input.sceneTags ?? "").toString(),
    storyboardBlock: (input.storyboardBlock ?? "").toString(),
    isReactionShot: Boolean(input.isReactionShot),
    dialogueType: (input.dialogueType ?? "").toString(),
    performanceNote: (input.performanceNote ?? "").toString(),
    bgmHint: (input.bgmHint ?? "").toString(),
    storyboardPrompt: (input.storyboardPrompt ?? "").toString(),
    videoMotionPrompt: (input.videoMotionPrompt ?? "").toString(),
    seedancePositive: input.seedancePositive,
    seedanceNegative: input.seedanceNegative,
    scene: (input.scene ?? "").toString(),
  };
}

export function normalizeScriptBeats(rows: ScriptBeat[] | undefined): ScriptBeat[] {
  return (rows ?? []).map((b) => normalizeScriptBeat(b as LegacyBeat));
}
