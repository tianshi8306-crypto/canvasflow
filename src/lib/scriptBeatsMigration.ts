import type { Node } from "@xyflow/react";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import { extractLightingMoodFromStoryboardBlock } from "@/lib/scriptLightingMood";
import { reconcileBeatPromptFields } from "@/lib/scriptPromptSynthesis";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";

export function migrateScriptBeatForLoad(beat: ScriptBeat): ScriptBeat {
  const normalized = normalizeScriptBeat(beat);
  let lightingMood = normalized.lightingMood.trim();
  const storyboardBlock = (normalized.storyboardBlock ?? "").trim();
  if (!lightingMood && storyboardBlock) {
    lightingMood = extractLightingMoodFromStoryboardBlock(storyboardBlock);
  }
  return reconcileBeatPromptFields(
    lightingMood ? { ...normalized, lightingMood } : normalized,
  );
}

export function migrateScriptNodesOnLoad(nodes: Node<FlowNodeData>[]): {
  nodes: Node<FlowNodeData>[];
  migratedCount: number;
} {
  let migratedCount = 0;
  const next = nodes.map((n) => {
    if (n.type !== "scriptNode") return n;
    const beats = n.data.scriptBeats;
    if (!beats?.length) return n;
    const migrated = beats.map((b) => migrateScriptBeatForLoad(b));
    const changed = migrated.some((b, i) => JSON.stringify(b) !== JSON.stringify(beats[i]));
    if (!changed) return n;
    migratedCount += 1;
    return { ...n, data: { ...n.data, scriptBeats: migrated } };
  });
  return { nodes: next, migratedCount };
}
