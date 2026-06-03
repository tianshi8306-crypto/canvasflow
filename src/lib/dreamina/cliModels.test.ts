import { describe, expect, it } from "vitest";
import {
  DREAMINA_CLI_TEXT2IMAGE_VERSIONS,
  DREAMINA_CLI_VIDEO_VERSIONS,
  defaultDreaminaImageModelPresets,
  defaultDreaminaVideoModelPresets,
  dreaminaCliModelId,
  mergeMissingDreaminaImagePresets,
} from "./cliModels";

describe("dreamina cliModels", () => {
  it("includes image 5.0 and video seedance variants from CLI help", () => {
    expect(DREAMINA_CLI_TEXT2IMAGE_VERSIONS).toContain("5.0");
    expect(DREAMINA_CLI_TEXT2IMAGE_VERSIONS).toContain("4.6");
    expect(DREAMINA_CLI_VIDEO_VERSIONS).toContain("seedance2.0fast_vip");
    expect(DREAMINA_CLI_VIDEO_VERSIONS).toContain("3.5pro");
  });

  it("builds dreamina/* model ids", () => {
    expect(dreaminaCliModelId("5.0")).toBe("dreamina/5.0");
    expect(dreaminaCliModelId("seedance2.0fast")).toBe("dreamina/seedance2.0fast");
  });

  it("merges missing dreamina image presets without duplicating", () => {
    const existing = defaultDreaminaImageModelPresets().slice(0, 2);
    const merged = mergeMissingDreaminaImagePresets(existing);
    expect(merged.length).toBe(defaultDreaminaImageModelPresets().length);
    expect(merged.some((m) => m.model === "dreamina/5.0")).toBe(true);
  });

  it("covers all CLI video versions in default presets", () => {
    const presets = defaultDreaminaVideoModelPresets();
    expect(presets).toHaveLength(DREAMINA_CLI_VIDEO_VERSIONS.length);
  });
});
