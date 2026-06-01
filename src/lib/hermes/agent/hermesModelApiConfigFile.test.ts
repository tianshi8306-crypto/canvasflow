import { describe, expect, it } from "vitest";
import {
  parseEnvModelApiConfig,
  parseJsonModelApiConfig,
  parseModelApiConfigFile,
  summarizeModelApiConfigFile,
} from "@/lib/hermes/agent/hermesModelApiConfigFile";

describe("hermesModelApiConfigFile", () => {
  it("parses .env with section headers", () => {
    const env = `
# chat
OPENAI_API_KEY=sk-chat1234567890
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# image
IMAGE_API_KEY=sk-image1234567890
IMAGE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
IMAGE_MODEL=Doubao-Seedream-5.0-lite
`;
    const parsed = parseEnvModelApiConfig(env);
    expect(parsed.drafts).toHaveLength(2);
    expect(parsed.drafts[0]?.lane).toBe("chat");
    expect(parsed.drafts[1]?.lane).toBe("image");
    expect(parsed.drafts[1]?.model).toBe("Doubao-Seedream-5.0-lite");
  });

  it("parses json lane map", () => {
    const json = JSON.stringify({
      chat: {
        apiKey: "sk-chat1234567890",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
      image: {
        apiKey: "sk-image1234567890",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        model: "Doubao-Seedream-5.0-lite",
      },
    });
    const parsed = parseJsonModelApiConfig(json);
    expect(parsed.drafts).toHaveLength(2);
  });

  it("parses canvasflow export shape", () => {
    const json = JSON.stringify({
      providers: [
        {
          id: "openai-compatible-1",
          label: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          enabled: true,
          priority: 0,
        },
      ],
      imageModels: [
        {
          id: "img-1",
          label: "Seedream",
          model: "Doubao-Seedream-5.0-lite",
          apiBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          enabled: true,
          priority: 0,
        },
      ],
      keys: {
        "openai-compatible-1": "sk-chat1234567890",
        "image-model:img-1": "sk-image1234567890",
      },
    });
    const parsed = parseJsonModelApiConfig(json);
    expect(parsed.drafts.length).toBeGreaterThanOrEqual(2);
  });

  it("summarize ack mentions confirm", () => {
    const parsed = parseModelApiConfigFile(
      "OPENAI_API_KEY=sk-chat1234567890\nOPENAI_MODEL=gpt-4o-mini",
      "keys.env",
    );
    const summary = summarizeModelApiConfigFile(parsed);
    expect(summary).toContain("keys.env");
    expect(summary).toContain("导入配置");
  });
});
