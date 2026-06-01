import { describe, expect, it } from "vitest";
import {
  buildImageGenValidationMessages,
  canStartImageGeneration,
} from "./buildImageGenValidationMessages";

describe("buildImageGenValidationMessages", () => {
  const base = {
    projectPath: "/proj",
    blockReason: null,
    effectivePromptText: "",
    task: null,
    validModelId: "m1",
    modelsLoading: false,
  };

  it("returns empty when only prompt/task missing (button disabled is enough)", () => {
    expect(buildImageGenValidationMessages(base)).toEqual([]);
  });

  it("returns blockReason when upstream blocks", () => {
    expect(
      buildImageGenValidationMessages({ ...base, blockReason: "需要至少 1 张参考图" }),
    ).toEqual(["需要至少 1 张参考图"]);
  });

  it("returns model hint when no enabled model", () => {
    expect(
      buildImageGenValidationMessages({ ...base, validModelId: "" }),
    ).toEqual(["未配置可用的图片模型。请在 设置 → 图片模型 中启用并配置 API Key"]);
  });
});

describe("canStartImageGeneration", () => {
  const ready = {
    projectPath: "/proj",
    blockReason: null,
    effectivePromptText: "a cat",
    task: "text_to_image" as const,
    validModelId: "m1",
    modelsLoading: false,
    isGenerating: false,
  };

  it("is false without prompt even when rail is silent", () => {
    expect(canStartImageGeneration({ ...ready, effectivePromptText: "" })).toBe(false);
  });

  it("is true when all prerequisites met", () => {
    expect(canStartImageGeneration(ready)).toBe(true);
  });
});
