import { describe, expect, it } from "vitest";
import {
  buildHermesToolRegistry,
  classifyHermesToolId,
  formatHermesToolRegistryForPrompt,
  getHermesToolRegistryEntry,
  isRegistryToolAllowed,
  sideEffectForCategory,
} from "@/lib/hermes/mcp/hermesToolRegistry";
import { defaultHermesAgentSettings } from "@/lib/hermes/agent/hermesAgentSettings";

describe("hermesToolRegistry", () => {
  it("classifies tool ids by domain", () => {
    expect(classifyHermesToolId("film.workflow_check")).toBe("read_only");
    expect(classifyHermesToolId("script.generate_storyboard")).toBe("script_write");
    expect(classifyHermesToolId("image.generate_for_beats")).toBe("media_gen");
    expect(classifyHermesToolId("compose.export_script")).toBe("export_compose");
  });

  it("builds registry from catalog with side effects", () => {
    const entries = buildHermesToolRegistry();
    expect(entries.length).toBeGreaterThan(5);
    const readOnly = entries.find((e) => e.toolId === "film.workflow_check");
    expect(readOnly?.sideEffects).toBe(sideEffectForCategory("read_only"));
    const video = entries.find((e) => e.toolId === "video.generate_for_beats");
    expect(video?.category).toBe("media_gen");
    expect(video?.sideEffects).toBe("submits_jobs");
  });

  it("formats grouped prompt with category headers", () => {
    const text = formatHermesToolRegistryForPrompt();
    expect(text).toContain("【只读 / 诊断】");
    expect(text).toContain("【媒体生成】");
    expect(text).toContain("无副作用");
    expect(text).toContain("film.workflow_check");
    expect(text).toContain("参数:");
    expect(text).toContain("agentGate");
  });

  it("gates media submit via registry", () => {
    const entry = getHermesToolRegistryEntry("image.generate_for_beats");
    expect(entry?.agentGate).toBe("media_submit");
    const blocked = isRegistryToolAllowed(entry!, {
      ...defaultHermesAgentSettings(),
      agentAllowMediaSubmit: false,
    });
    expect(blocked.allowed).toBe(false);
  });

  it("includes supplement tools not only catalog", () => {
    expect(getHermesToolRegistryEntry("image.retry_failed")?.riskTier).toBe("submit");
    expect(getHermesToolRegistryEntry("video.retry_failed")?.riskTier).toBe("submit");
  });
});
