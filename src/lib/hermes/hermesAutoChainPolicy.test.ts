import { describe, expect, it } from "vitest";
import {
  evaluateHermesAutoChainTrigger,
  listStoryboardReadyBeatIds,
  resolveHermesEnabled,
} from "@/lib/hermes/hermesAutoChainPolicy";
import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";

describe("hermesAutoChainPolicy", () => {
  const beats: ScriptBeat[] = [
    { ...emptyScriptBeat(), id: "b1" },
    { ...emptyScriptBeat(), id: "b2" },
  ];
  const shots: StoryboardShot[] = [
    { scriptBeatId: "b1", visualPrompt: "雨夜", status: "generated" },
    { scriptBeatId: "b2", visualPrompt: "", status: "idle" },
  ];

  it("resolveHermesEnabled respects node off", () => {
    expect(resolveHermesEnabled({ enabled: true, scope: "all_ready" }, "off")).toBe(false);
    expect(resolveHermesEnabled({ enabled: false, scope: "all_ready" }, "on")).toBe(true);
  });

  it("lists only generated shots with prompt", () => {
    expect(listStoryboardReadyBeatIds(beats, shots)).toEqual(["b1"]);
  });

  it("does not run when global disabled", () => {
    const r = evaluateHermesAutoChainTrigger({
      globalSettings: { enabled: false, scope: "selected_only" },
      nodeParams: {},
      beats,
      shots,
      scriptBeatSelection: ["b1"],
    });
    expect(r.shouldRun).toBe(false);
  });

  it("selected_only requires selection", () => {
    const r = evaluateHermesAutoChainTrigger({
      globalSettings: { enabled: true, scope: "selected_only" },
      nodeParams: {},
      beats,
      shots,
      scriptBeatSelection: [],
    });
    expect(r.shouldRun).toBe(false);
  });

  it("runs for selected ready beats only", () => {
    const r = evaluateHermesAutoChainTrigger({
      globalSettings: { enabled: true, scope: "selected_only" },
      nodeParams: {},
      beats,
      shots,
      scriptBeatSelection: ["b1", "b2"],
    });
    expect(r.shouldRun).toBe(true);
    if (r.shouldRun) expect(r.beatIds).toEqual(["b1"]);
  });
});
