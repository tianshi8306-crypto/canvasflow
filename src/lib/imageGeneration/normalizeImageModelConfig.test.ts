import { describe, expect, it } from "vitest";
import { normalizeImageModelConfigOnLoad } from "@/lib/imageGeneration/normalizeImageModelConfig";
import type { ImageModelConfig } from "@/lib/settingsPanelTypes";

const base: ImageModelConfig = {
  id: "x",
  vendorName: "",
  modelName: "",
  modelVariant: "gpt-image-2-vip",
  label: "",
  model: "gpt-image-2-vip",
  apiBaseUrl: "api.apiyi.com/v1",
  enabled: true,
  priority: 0,
};

describe("normalizeImageModelConfigOnLoad", () => {
  it("adds https and forces images endpoint for APIYI gpt-image", () => {
    const out = normalizeImageModelConfigOnLoad(base);
    expect(out.apiBaseUrl).toBe("https://api.apiyi.com/v1");
    expect(out.vendorName).toBe("APIYI");
    expect(out.endpointType).toBe("images");
  });
});
