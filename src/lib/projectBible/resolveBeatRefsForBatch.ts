import { collectBeatRoleReferencePaths } from "@/lib/projectBible/bibleRoleBindings";
import type { ProjectBible } from "@/lib/projectBible/projectBible";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import type { ScriptBeat } from "@/lib/types";

export function createBeatReferenceResolver(
  beats: ScriptBeat[] | undefined,
  bible: ProjectBible | null,
): (beatId: string) => string[] {
  const norm = normalizeScriptBeats(beats);
  const byId = new Map(norm.map((b) => [b.id, b]));
  return (beatId: string) => {
    const beat = byId.get(beatId);
    if (!beat) return [];
    return collectBeatRoleReferencePaths(beat, bible);
  };
}
