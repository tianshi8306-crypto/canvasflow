import { describe, expect, it } from "vitest";
import {
  extractApiKey,
  extractBaseUrl,
  extractModelId,
  inferModelApiLane,
  isModelApiConfigIntent,
  isModelApiConfigStatusIntent,
  parseModelApiMaterials,
} from "@/lib/hermes/agent/hermesModelApiConfig";

describe("hermesModelApiConfig parse", () => {
  it("detects configure intent", () => {
    expect(isModelApiConfigIntent("帮我配置图片模型 api")).toBe(true);
    expect(isModelApiConfigIntent("图片模型：")).toBe(true);
    expect(isModelApiConfigStatusIntent("模型配置怎么样了")).toBe(true);
    expect(isModelApiConfigIntent("蒙太奇是什么")).toBe(false);
  });

  it("extracts fields from pasted materials", () => {
    const text = `
配置图片模型
api: https://ark.cn-beijing.volces.com/api/v3
key: sk-test1234567890
model: Doubao-Seedream-5.0-lite
`;
    expect(extractBaseUrl(text)).toBe("https://ark.cn-beijing.volces.com/api/v3");
    expect(extractApiKey(text)).toBe("sk-test1234567890");
    expect(extractModelId(text)).toBe("Doubao-Seedream-5.0-lite");
    expect(inferModelApiLane(text)).toBe("image");
    expect(parseModelApiMaterials(text)?.lane).toBe("image");
  });

  it("parses chat provider configure intent", () => {
    const text =
      "配置对话模型 openai https://api.openai.com/v1 key sk-abc123456789 model gpt-4o-mini";
    const draft = parseModelApiMaterials(text);
    expect(draft?.lane).toBe("chat");
    expect(draft?.baseUrl).toContain("api.openai.com");
    expect(draft?.apiKey).toBe("sk-abc123456789");
    expect(draft?.model).toBe("gpt-4o-mini");
  });

  it("parses json block", () => {
    const text = `视频模型配置 ${JSON.stringify({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-jsonkey123456",
      model: "doubao-seedance-2.0",
    })}`;
    expect(parseModelApiMaterials(text)?.lane).toBe("video");
    expect(extractApiKey(text)).toBe("sk-jsonkey123456");
  });
});
