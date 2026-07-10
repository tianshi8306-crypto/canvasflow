import { normalizeScriptBeat, normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import type { ScriptBeat } from "@/lib/types";
import { reconcileBeatsPromptFields } from "@/lib/scriptPromptSynthesis";
import { applyDraftSyncToNodeData } from "@/lib/scriptDraftActions";
import { syncScriptBeatsFromDraft } from "@/lib/syncScriptBeatsFromDraft";

export type ScriptDraftBeatsPatch = {
  storyboardDraft?: string;
  scriptBeats?: ScriptBeat[];
  scriptBeatSelection?: string[];
  scriptShotCount?: number;
};

function parseDurationSec(hint: string | undefined): number | null {
  if (!hint?.trim()) return null;
  const m = hint.match(/([\d.]+)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

function buildStoryboardBlockFromBeat(b: ScriptBeat): string {
  if (b.storyboardBlock?.trim()) {
    return b.storyboardBlock.trim();
  }
  const lines: string[] = [];
  const dur = b.durationHint?.trim();
  if (dur) lines.push(`时长：${dur.includes("秒") ? dur : `${dur}秒`}`);
  if (b.shotSize?.trim()) lines.push(`景别：${b.shotSize.trim()}`);
  if (b.lightingMood?.trim()) lines.push(`光影：${b.lightingMood.trim()}`);
  if (b.description?.trim()) lines.push(`画面：${b.description.trim()}`);
  if (b.cameraMove?.trim()) {
    const angle = b.cameraAngle?.trim();
    lines.push(
      angle
        ? `镜头运动：${b.cameraMove.trim()}（${angle}）`
        : `镜头运动：${b.cameraMove.trim()}`,
    );
  }
  if (b.dialogue?.trim()) lines.push(`台词：${b.dialogue.trim()}`);
  else lines.push("台词：无");
  if (b.soundHint?.trim()) lines.push(`声音：${b.soundHint.trim()}`);
  if (b.editFocus?.trim()) lines.push(`剪辑重点：${b.editFocus.trim()}`);
  if (b.performanceNote?.trim()) lines.push(`表演：${b.performanceNote.trim()}`);
  if (b.bgmHint?.trim()) lines.push(`BGM：${b.bgmHint.trim()}`);
  return lines.join("\n");
}

/** 镜头表 → 整份分镜稿（与后端 assemble_storyboard_draft 对齐） */
export function assembleStoryboardDraftFromBeats(beats: ScriptBeat[]): string {
  const rows = normalizeScriptBeats(beats);
  if (rows.length === 0) return "";

  return rows
    .map((b, i) => {
      const sn = (b.episodeSceneShot || b.shotNumber || String(i + 1)).trim();
      const purpose = (b.rhythmTag || b.sceneTags || "").trim();
      const dur = parseDurationSec(b.durationHint) ?? 2.0;
      const header = purpose
        ? `---\n镜 ${sn} · ${purpose} · ${dur}s`
        : `---\n镜 ${sn} · ${dur}s`;
      const scene = b.sceneHeading?.trim() ? `\n场：${b.sceneHeading.trim()}` : "";
      return `${header}${scene}\n${buildStoryboardBlockFromBeat(b)}`;
    })
    .join("\n\n");
}

/** 改分镜稿 → 同步 patch（解析失败则只写 draft，不覆盖 beats） */
export function patchFromStoryboardDraftEdit(
  draft: string,
  existingBeats: ScriptBeat[],
  existingSelection?: string[],
): ScriptDraftBeatsPatch {
  const trimmed = draft.trim();
  if (!trimmed) {
    return { storyboardDraft: draft };
  }

  const synced = applyDraftSyncToNodeData({
    draft,
    existingBeats,
    existingSelection,
  });

  if (!synced.ok) {
    return { storyboardDraft: draft };
  }

  return {
    storyboardDraft: draft,
    scriptBeats: synced.beats,
    scriptBeatSelection: synced.selection,
    scriptShotCount: synced.beats.length,
  };
}

/** 改镜头表 → 同步 patch（总是回写分镜稿） */
export function patchFromScriptBeatsEdit(
  beats: ScriptBeat[],
  storedSelection?: string[],
): ScriptDraftBeatsPatch {
  const normalized = reconcileBeatsPromptFields(beats.map((b) => normalizeScriptBeat(b)));
  const valid = new Set(normalized.map((b) => b.id));
  const prunedSelection = (storedSelection ?? []).filter((id) => valid.has(id));
  const draft = assembleStoryboardDraftFromBeats(normalized);

  return {
    scriptBeats: normalized,
    scriptBeatSelection: prunedSelection,
    scriptShotCount: normalized.length,
    storyboardDraft: draft,
  };
}

/** 解析是否足以触发 beats 回写（供 UI 提示，可选） */
export function canSyncBeatsFromDraft(draft: string): boolean {
  const r = syncScriptBeatsFromDraft(draft.trim());
  return r.ok;
}
