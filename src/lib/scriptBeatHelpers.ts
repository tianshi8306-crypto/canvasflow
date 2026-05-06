import type { ScriptBeat, ScriptRole } from "@/lib/types";

/** 与持久化 JSON 对齐的默认空字段（不含 id） */
export const SCRIPT_BEAT_EMPTY_FIELDS: Omit<ScriptBeat, "id"> = {
  shotNumber: "",
  scene: "",
  durationHint: "",
  description: "",
  character1: "",
  character1Desc: "",
  character1Image: "",
  character2: "",
  character2Desc: "",
  character2Image: "",
  characters: [],
  reference: "",
  shotSize: "",
  characterAction: "",
  emotion: "",
  sceneTags: "",
  lightingMood: "",
  soundEffect: "",
  dialogue: "",
  storyboardPrompt: "",
  videoMotionPrompt: "",
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
  if (out.length > 0) return out;
  const c1 = (input.character1 ?? "").toString().trim();
  const c2 = (input.character2 ?? "").toString().trim();
  if (c1) {
    out.push({
      id: crypto.randomUUID(),
      name: c1,
      description: (input.character1Desc ?? "").toString(),
      imagePath: (input.character1Image ?? "").toString(),
      reference: "",
      action: (input.characterAction ?? "").toString(),
      emotion: (input.emotion ?? "").toString(),
      lines: (input.dialogue ?? "").toString(),
    });
  }
  if (c2) {
    out.push({
      id: crypto.randomUUID(),
      name: c2,
      description: (input.character2Desc ?? "").toString(),
      imagePath: (input.character2Image ?? "").toString(),
      reference: "",
      action: "",
      emotion: "",
      lines: "",
    });
  }
  return out;
}

/** 合并旧数据：缺省字段补空；旧版 `shot`（景别/运动）并入 `shotSize`，且不写回 `shot` 字段 */
export function normalizeScriptBeat(input: LegacyBeat): ScriptBeat {
  const { shot: legacyShot, ...inputRest } = input;
  const shotSize = ((inputRest.shotSize ?? legacyShot) ?? "").toString();
  const roles = normalizeRoles(input);
  const r1 = roles[0];
  const r2 = roles[1];
  return {
    ...SCRIPT_BEAT_EMPTY_FIELDS,
    ...inputRest,
    id: input.id,
    shotId: (inputRest.shotId ?? input.id).toString(),
    timeIn: typeof inputRest.timeIn === "number" ? inputRest.timeIn : undefined,
    timeOut: typeof inputRest.timeOut === "number" ? inputRest.timeOut : undefined,
    shotNumber: (input.shotNumber ?? "").toString(),
    scene: (input.scene ?? "").toString(),
    durationHint: (input.durationHint ?? "").toString(),
    description: (input.description ?? "").toString(),
    character1: (r1?.name ?? input.character1 ?? "").toString(),
    character1Desc: (r1?.description ?? input.character1Desc ?? "").toString(),
    character1Image: (r1?.imagePath ?? input.character1Image ?? "").toString(),
    character2: (r2?.name ?? input.character2 ?? "").toString(),
    character2Desc: (r2?.description ?? input.character2Desc ?? "").toString(),
    character2Image: (r2?.imagePath ?? input.character2Image ?? "").toString(),
    characters: roles,
    reference: (input.reference ?? "").toString(),
    shotSize,
    characterAction: (r1?.action ?? input.characterAction ?? "").toString(),
    emotion: (r1?.emotion ?? input.emotion ?? "").toString(),
    sceneTags: (input.sceneTags ?? "").toString(),
    lightingMood: (input.lightingMood ?? "").toString(),
    soundEffect: (input.soundEffect ?? "").toString(),
    dialogue: (r1?.lines ?? input.dialogue ?? "").toString(),
    storyboardPrompt: (input.storyboardPrompt ?? "").toString(),
    videoMotionPrompt: (input.videoMotionPrompt ?? "").toString(),
  };
}

export function normalizeScriptBeats(rows: ScriptBeat[] | undefined): ScriptBeat[] {
  return (rows ?? []).map((b) => normalizeScriptBeat(b as LegacyBeat));
}
