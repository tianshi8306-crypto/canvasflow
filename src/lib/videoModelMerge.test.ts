import { describe, expect, it } from "vitest";
import { mergeVideoModelOptionsFromSettings, listSelectableVideoModelIds } from "./videoModelMerge";
import type { AppSettings } from "./settingsPanelTypes";

describe("mergeVideoModelOptionsFromSettings", () => {
  it("appends dreamina CLI when only doubao in settings", () => {
    const models = mergeVideoModelOptionsFromSettings([
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
    ]);
    expect(models.map((m) => m.id)).toContain("doubao_seedance_2_0");
    expect(models.map((m) => m.id)).toContain("dreamina/seedance2.0");
    const dreamina = models.find((m) => m.id === "dreamina/seedance2.0");
    expect(dreamina?.settingsId).toBeNull();
    expect(dreamina?.enabled).toBe(true);
  });

  it("does not duplicate dreamina when already in settings", () => {
    const models = mergeVideoModelOptionsFromSettings([
      {
        id: "a",
        vendorName: "",
        modelName: "",
        modelVariant: "",
        label: "即梦",
        model: "dreamina/seedance2.0",
        apiBaseUrl: "",
        enabled: true,
        priority: 0,
      },
    ]);
    expect(models.filter((m) => m.id === "dreamina/seedance2.0")).toHaveLength(1);
    expect(models[0]?.settingsId).toBe("a");
  });

  it("skips dreamina builtin when user disabled it in settings", () => {
    const models = mergeVideoModelOptionsFromSettings([
      {
        id: "d",
        vendorName: "",
        modelName: "",
        modelVariant: "",
        label: "即梦",
        model: "dreamina/seedance2.0",
        apiBaseUrl: "",
        enabled: false,
        priority: 0,
      },
    ]);
    expect(models.filter((m) => m.id === "dreamina/seedance2.0")).toHaveLength(1);
    expect(models[0]?.enabled).toBe(false);
  });
});

const baseSettings = {
  videoModels: [],
} as unknown as AppSettings;

describe("listSelectableVideoModelIds", () => {
  it("includes enabled dreamina builtin", () => {
    const ids = listSelectableVideoModelIds({
      ...baseSettings,
      videoModels: [
        {
          id: "p1",
          vendorName: "",
          modelName: "",
          modelVariant: "",
          label: "Doubao",
          model: "doubao_seedance_2_0",
          apiBaseUrl: "",
          enabled: true,
          priority: 0,
        },
      ],
    });
    expect(ids).toContain("doubao_seedance_2_0");
    expect(ids).toContain("dreamina/seedance2.0");
  });
});
