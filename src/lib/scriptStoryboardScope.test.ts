import { describe, expect, it } from "vitest";
import {
  resolveStoryboardBeatScope,
  storyboardScopeToolbarLabel,
} from "@/lib/scriptStoryboardScope";
import type { ScriptBeat } from "@/lib/types";

function beat(id: string): ScriptBeat {
  return {
    id,
    shotNumber: "1",
    scene: "",
    durationHint: "3s",
    description: "d",
    character1: "",
    character1Desc: "",
    character1Image: "",
    character2: "",
    character2Desc: "",
    character2Image: "",
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
}

describe("resolveStoryboardBeatScope", () => {
  const rows = [beat("a"), beat("b"), beat("c")];

  it("uses all beats when selection empty", () => {
    const r = resolveStoryboardBeatScope(rows, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scope.mode).toBe("all");
    expect(r.scope.beats).toHaveLength(3);
  });

  it("uses only valid selected beats", () => {
    const r = resolveStoryboardBeatScope(rows, ["b", "missing"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scope.mode).toBe("selected");
    expect(r.scope.beats.map((b) => b.id)).toEqual(["b"]);
    expect(r.scope.selectedCount).toBe(1);
  });

  it("fails when selection ids are all stale", () => {
    const r = resolveStoryboardBeatScope(rows, ["gone"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("重新勾选");
  });

  it("toolbar label reflects selection count", () => {
    const r = resolveStoryboardBeatScope(rows, ["a", "c"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(storyboardScopeToolbarLabel(r.scope)).toBe("生成分镜（2）");
  });
});
