import { emptyScriptBeat, normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import type { ScriptBeat } from "@/lib/types";

export type SyncDraftResult =
  | { ok: true; beats: ScriptBeat[]; parsedCount: number }
  | { ok: false; message: string };

const BLOCK_SEP = /\n---\n/;

function parseLabeledLine(line: string, labels: string[]): string | null {
  const t = line.trim();
  for (const label of labels) {
    if (t.startsWith(label)) {
      return t.slice(label.length).trim();
    }
  }
  return null;
}

/** 解析分镜稿块首行：`镜 1-1-01 · 建立 · 2.5s` */
function parseBlockHeader(firstLine: string): {
  shotNumber: string;
  rhythmTag: string;
  durationHint: string;
} {
  const line = firstLine.trim();
  const m = line.match(/^镜\s+(.+?)(?:\s*·\s*(.+?))?(?:\s*·\s*([\d.]+)\s*s)?\s*$/i);
  if (!m) {
    return { shotNumber: "", rhythmTag: "", durationHint: "" };
  }
  const shotNumber = (m[1] ?? "").trim();
  const rhythmTag = (m[2] ?? "").trim();
  const durationHint = (m[3] ?? "").trim();
  return { shotNumber, rhythmTag, durationHint };
}

/** 从 `镜头运动：跟拍（侧）` 拆运镜与角度 */
function parseCameraLine(raw: string): { move: string; angle: string } {
  const inner = raw.match(/^(.+?)（(.+?)）$/) ?? raw.match(/^(.+?)\((.+?)\)$/);
  if (inner) {
    return { move: inner[1].trim(), angle: inner[2].trim() };
  }
  return { move: raw.trim(), angle: "" };
}

function parseDraftBlock(block: string): Partial<ScriptBeat> & { storyboardBlock: string } {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const contentLines = lines[0]?.startsWith("---") ? lines.slice(1) : lines;
  const header = contentLines[0] ?? "";
  const { shotNumber, rhythmTag, durationHint: durFromHeader } = parseBlockHeader(header);

  let sceneHeading = "";
  let durationHint = durFromHeader;
  let shotSize = "";
  let description = "";
  let cameraMove = "";
  let cameraAngle = "";
  let dialogue = "";
  let soundHint = "";
  let editFocus = "";
  let performanceNote = "";
  let bgmHint = "";
  let dialogueType = "";
  let lightingMood = "";

  const bodyStart = header.startsWith("镜") ? 1 : 0;
  for (const line of contentLines.slice(bodyStart)) {
    const scene =
      parseLabeledLine(line, ["场：", "场:", "场景：", "场景:"]) ??
      parseLabeledLine(line, ["场 "]);
    if (scene != null) {
      sceneHeading = scene;
      continue;
    }
    const dur = parseLabeledLine(line, ["时长：", "时长:"]);
    if (dur != null) {
      durationHint = dur.replace(/秒\s*$/, "").trim();
      continue;
    }
    const size = parseLabeledLine(line, ["景别：", "景别:"]);
    if (size != null) {
      shotSize = size;
      continue;
    }
    const light =
      parseLabeledLine(line, ["光影氛围：", "光影氛围:", "光影：", "光影:", "光线：", "光线:"]) ??
      null;
    if (light != null) {
      lightingMood = light;
      continue;
    }
    const vis = parseLabeledLine(line, ["画面：", "画面:"]);
    if (vis != null) {
      description = vis;
      continue;
    }
    const cam = parseLabeledLine(line, ["镜头运动：", "镜头运动:", "运镜：", "运镜:"]);
    if (cam != null) {
      const parsed = parseCameraLine(cam);
      cameraMove = parsed.move;
      cameraAngle = parsed.angle;
      continue;
    }
    const dlg = parseLabeledLine(line, ["台词：", "台词:"]);
    if (dlg != null) {
      dialogue = dlg === "无" ? "" : dlg;
      continue;
    }
    const snd = parseLabeledLine(line, ["声音：", "声音:"]);
    if (snd != null) {
      soundHint = snd;
      continue;
    }
    const edit = parseLabeledLine(line, ["剪辑重点：", "剪辑重点:", "剪辑：", "剪辑:"]);
    if (edit != null) {
      editFocus = edit;
      continue;
    }
    const perf = parseLabeledLine(line, ["表演：", "表演:"]);
    if (perf != null) {
      performanceNote = perf;
      continue;
    }
    const bgm = parseLabeledLine(line, ["BGM：", "BGM:", "bgm：", "bgm:"]);
    if (bgm != null) {
      bgmHint = bgm;
      continue;
    }
    const dlgType = parseLabeledLine(line, ["对白类型：", "对白类型:"]);
    if (dlgType != null) {
      dialogueType = dlgType;
      continue;
    }
  }

  const storyboardBlock = contentLines.slice(bodyStart).join("\n");
  const episodeSceneShot = shotNumber.includes("-") ? shotNumber : "";

  return {
    shotNumber: shotNumber || episodeSceneShot,
    episodeSceneShot,
    sceneHeading,
    durationHint: durationHint ? `${durationHint}秒`.replace(/秒秒/, "秒") : "",
    shotSize,
    lightingMood,
    description,
    cameraMove,
    cameraAngle,
    dialogue,
    soundHint,
    editFocus,
    performanceNote,
    bgmHint,
    dialogueType,
    rhythmTag,
    sceneTags: rhythmTag,
    storyboardBlock: storyboardBlock || contentLines.join("\n"),
    isReactionShot: editFocus.includes("反应") || description.includes("反应镜头"),
  };
}

/** 有效分镜块须含「镜」标题行，或至少一条结构化字段（避免纯散文误同步） */
function isValidDraftBlock(
  parsed: Partial<ScriptBeat> & { storyboardBlock: string },
  contentLines: string[],
): boolean {
  const header = (contentLines[0] ?? "").trim();
  if (header.startsWith("镜")) return true;
  return Boolean(
    parsed.description?.trim() ||
      parsed.shotSize?.trim() ||
      parsed.cameraMove?.trim() ||
      parsed.dialogue?.trim() ||
      parsed.sceneHeading?.trim(),
  );
}

function beatMatchKey(b: ScriptBeat): string {
  return (b.episodeSceneShot || b.shotNumber || "").trim();
}

/**
 * 从节点预览分镜稿解析镜头表；按镜号尽量保留已有 beat id 与 Seedance 字段。
 */
export function syncScriptBeatsFromDraft(
  draft: string,
  existingBeats: ScriptBeat[] = [],
): SyncDraftResult {
  const trimmed = draft.trim();
  if (!trimmed) {
    return { ok: false, message: "分镜稿为空，无法同步" };
  }

  if (!trimmed.includes("---")) {
    return { ok: false, message: "未识别到分镜块（用 --- 分隔）" };
  }

  const normalized = trimmed.startsWith("---") ? trimmed : `---\n${trimmed}`;
  const rawBlocks = normalized
    .split(BLOCK_SEP)
    .map((b) => b.trim())
    .filter(Boolean);

  if (rawBlocks.length === 0) {
    return { ok: false, message: "未识别到分镜块（用 --- 分隔）" };
  }

  const existingByKey = new Map<string, ScriptBeat>();
  for (const b of existingBeats) {
    const key = beatMatchKey(b);
    if (key) existingByKey.set(key, b);
  }

  const beats: ScriptBeat[] = [];
  for (const block of rawBlocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const contentLines = lines[0]?.startsWith("---") ? lines.slice(1) : lines;
    const parsed = parseDraftBlock(block);
    if (!isValidDraftBlock(parsed, contentLines)) {
      continue;
    }
    const key = (parsed.episodeSceneShot || parsed.shotNumber || "").trim();
    const prev = key ? existingByKey.get(key) : undefined;
    const base = prev ? normalizeScriptBeat(prev) : emptyScriptBeat();

    beats.push(
      normalizeScriptBeat({
        ...base,
        ...parsed,
        id: base.id,
        shotId: base.shotId ?? base.id,
        storyboardPrompt: base.storyboardPrompt,
        seedancePositive: base.seedancePositive,
        seedanceNegative: base.seedanceNegative,
        videoMotionPrompt: base.videoMotionPrompt,
      }),
    );
  }

  if (beats.length === 0) {
    return { ok: false, message: "分镜稿中未解析出有效镜头" };
  }

  return { ok: true, beats, parsedCount: beats.length };
}
