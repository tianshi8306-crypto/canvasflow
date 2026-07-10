import type { ScriptBeat } from "@/lib/types";
import { reconcileBeatsPromptFields } from "@/lib/scriptPromptSynthesis";
import { syncScriptBeatsFromDraft } from "@/lib/syncScriptBeatsFromDraft";

export type ApplyDraftSyncArgs = {
  draft: string;
  existingBeats: ScriptBeat[];
  existingSelection?: string[];
};

export type ApplyDraftSyncResult =
  | {
      ok: true;
      beats: ScriptBeat[];
      selection: string[];
      message: string;
    }
  | { ok: false; message: string };

/** 分镜稿 → scriptBeats + 勾选（新镜默认全选） */
export function applyDraftSyncToNodeData({
  draft,
  existingBeats,
  existingSelection,
}: ApplyDraftSyncArgs): ApplyDraftSyncResult {
  const parsed = syncScriptBeatsFromDraft(draft, existingBeats);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }
  const valid = new Set(parsed.beats.map((b) => b.id));
  const pruned = (existingSelection ?? []).filter((id) => valid.has(id));
  const selection =
    pruned.length > 0 ? pruned : parsed.beats.map((b) => b.id);
  return {
    ok: true,
    beats: reconcileBeatsPromptFields(parsed.beats),
    selection,
    message: `已从分镜稿同步 ${parsed.parsedCount} 条镜头`,
  };
}
