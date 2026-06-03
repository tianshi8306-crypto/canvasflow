import { describe, expect, it } from "vitest";
import {
  defaultImageModelPresets,
  ensureModelListDefaults,
  listAddableChatProviderIds,
} from "./settingsModelDefaults";
import type { AppSettings } from "./settingsPanelTypes";

const base: AppSettings = {
  providers: [],
  imageModels: [],
  videoModels: [],
  audioModels: [],
  defaultProviderId: null,
  ffmpegPath: null,
  abortWorkflowOnFailure: false,
  themePreset: "dark",
  fontSize: "medium",
  cursorStyle: "default",
  gridDotsVisible: true,
  promptActionSurface: "themed",
  showVideoMeta: true,
  imageVideoNodeResizeEnabled: true,
  promptBoxResizeEnabled: true,
  titleFollowsCanvasZoom: true,
  nodeSpacing: 120,
  nodeDirection: "right",
  nodeAvoidOverlap: true,
  selectionRelatedHighlightEnabled: true,
  selectionRelatedHighlightColor: "white",
  snapGuidesEnabled: true,
  connectionLinesVisible: true,
  snapGridEnabled: false,
  alignFeatureTriggerMode: "click",
  alignDistributeGap: 40,
  uploadQuality: "standard",
};

describe("ensureModelListDefaults", () => {
  it("seeds chat + seedream + full dreamina CLI catalogs when empty", () => {
    const next = ensureModelListDefaults(base);
    expect(next.providers.some((p) => p.id === "deepseek" && p.model === "deepseek-v4-flash")).toBe(true);
    expect(next.defaultProviderId).toBe("deepseek");
    expect(next.imageModels.some((m) => m.model === "Doubao-Seedream-5.0-lite")).toBe(true);
    expect(next.imageModels.some((m) => m.model === "dreamina/5.0")).toBe(true);
    expect(next.videoModels.some((m) => m.model === "dreamina/seedance2.0fast")).toBe(true);
    expect(next.audioModels).toHaveLength(1);
  });

  it("does not replace existing image models but merges missing dreamina CLI", () => {
    const next = ensureModelListDefaults({
      ...base,
      imageModels: [{ ...defaultImageModelPresets()[0]!, id: "custom-only" }],
    });
    expect(next.imageModels[0]?.id).toBe("custom-only");
    expect(next.imageModels.some((m) => m.model === "dreamina/5.0")).toBe(true);
  });

  it("merges missing dreamina image preset when only seedream exists", () => {
    const next = ensureModelListDefaults({
      ...base,
      imageModels: [{ ...defaultImageModelPresets()[0]! }],
    });
    expect(next.imageModels.some((m) => m.model === "dreamina/5.0")).toBe(true);
  });

  it("merges missing dreamina video preset when only doubao exists", () => {
    const next = ensureModelListDefaults({
      ...base,
      videoModels: [
        {
          id: "preset-video-doubao-seedance",
          vendorName: "",
          modelName: "",
          modelVariant: "",
          label: "Doubao Seedance 2.0",
          model: "doubao_seedance_2_0",
          apiBaseUrl: "",
          enabled: true,
          priority: 0,
        },
      ],
    });
    expect(next.videoModels.some((m) => m.model === "dreamina/seedance2.0")).toBe(true);
    expect(next.videoModels.some((m) => m.model === "dreamina/seedance2.0fast")).toBe(true);
    expect(next.videoModels.length).toBeGreaterThan(2);
  });
});

describe("listAddableChatProviderIds", () => {
  it("lists deepseek first among addable providers", () => {
    const ids = listAddableChatProviderIds([]);
    expect(ids[0]).toBe("deepseek");
    expect(ids).toContain("doubao");
    expect(ids).toContain("glm");
  });

  it("excludes dreamina and already configured", () => {
    const ids = listAddableChatProviderIds([
      { id: "openai", label: "x", baseUrl: "", model: "m", priority: 0, enabled: true },
    ]);
    expect(ids).not.toContain("dreamina");
    expect(ids).not.toContain("openai");
    expect(ids.length).toBeGreaterThan(0);
  });
});
