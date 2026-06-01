import { describe, expect, it } from "vitest";
import {
  defaultHermesAutoChainSettings,
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
    const on = { ...defaultHermesAutoChainSettings(), enabled: true, scope: "all_ready" as const };
    const off = { ...defaultHermesAutoChainSettings(), enabled: false, scope: "all_ready" as const };
    expect(resolveHermesEnabled(on, "off")).toBe(false);
    expect(resolveHermesEnabled(off, "on")).toBe(true);
  });

  it("lists only generated shots with prompt", () => {
    expect(listStoryboardReadyBeatIds(beats, shots)).toEqual(["b1"]);
  });

  it("does not run when global disabled", () => {
    const r = evaluateHermesAutoChainTrigger({
      globalSettings: { ...defaultHermesAutoChainSettings(), enabled: false },
      nodeParams: {},
      beats,
      shots,
      scriptBeatSelection: ["b1"],
    });
    expect(r.shouldRun).toBe(false);
  });

  it("selected_only requires selection", () => {
    const r = evaluateHermesAutoChainTrigger({
      globalSettings: { ...defaultHermesAutoChainSettings(), enabled: true },
      nodeParams: {},
      beats,
      shots,
      scriptBeatSelection: [],
    });
    expect(r.shouldRun).toBe(false);
  });

  it("runs for selected ready beats only", () => {
    const r = evaluateHermesAutoChainTrigger({
      globalSettings: { ...defaultHermesAutoChainSettings(), enabled: true },
      nodeParams: {},
      beats,
      shots,
      scriptBeatSelection: ["b1", "b2"],
    });
    expect(r.shouldRun).toBe(true);
    if (r.shouldRun) expect(r.beatIds).toEqual(["b1"]);
  });
});
