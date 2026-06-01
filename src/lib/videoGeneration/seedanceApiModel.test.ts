import { describe, expect, it } from "vitest";
import {
  DOUBAO_SEEDANCE_API_MODEL,
  DOUBAO_SEEDANCE_CANONICAL_ID,
  normalizeVideoModelConfigOnLoad,
} from "./seedanceApiModel";
import { videoModelConfigMatches, videoModelOptionId } from "@/lib/videoModelMerge";

describe("seedanceApiModel", () => {
  it("upgrades legacy slug on load", () => {
    const next = normalizeVideoModelConfigOnLoad({
      id: "preset-video-doubao-seedance",
      vendorName: "",
      modelName: "",
      modelVariant: "",
      label: "Doubao Seedance 2.0",
      model: DOUBAO_SEEDANCE_CANONICAL_ID,
      apiBaseUrl: "",
      enabled: true,
      priority: 0,
    });
    expect(next.model).toBe(DOUBAO_SEEDANCE_API_MODEL);
  });

  it("keeps canvas option id stable while settings use API model", () => {
    const cfg = {
      id: "preset-video-doubao-seedance",
      vendorName: "",
      modelName: "",
      modelVariant: "",
      label: "Doubao Seedance 2.0",
      model: DOUBAO_SEEDANCE_API_MODEL,
      apiBaseUrl: "",
      enabled: true,
      priority: 0,
    };
    expect(videoModelOptionId(cfg)).toBe(DOUBAO_SEEDANCE_CANONICAL_ID);
    expect(videoModelConfigMatches(cfg, DOUBAO_SEEDANCE_CANONICAL_ID)).toBe(true);
  });
});
