import { describe, expect, it } from "vitest";
import {
  resolveScriptProviderId,
  scriptNodeLlmInvokeParams,
} from "@/lib/scriptNodeLlmParams";
import type { TextNodeProviderOption } from "@/lib/textNodeProviders";

const providers: TextNodeProviderOption[] = [
  { id: "openai", label: "OpenAI", model: "gpt-4", priority: 2, enabled: true },
  { id: "deepseek", label: "DeepSeek", model: "deepseek-chat", priority: 1, enabled: true },
];

describe("scriptNodeLlmInvokeParams", () => {
  it("omits empty provider and model", () => {
    expect(scriptNodeLlmInvokeParams({})).toEqual({});
    expect(scriptNodeLlmInvokeParams({ providerId: "  ", model: "" })).toEqual({});
  });

  it("passes trimmed providerId and model", () => {
    expect(scriptNodeLlmInvokeParams({ providerId: " openai ", model: " gpt-4 " })).toEqual({
      providerId: "openai",
      model: "gpt-4",
    });
  });
});

describe("resolveScriptProviderId", () => {
  it("prefers node selection when enabled", () => {
    expect(resolveScriptProviderId({ providerId: "deepseek" }, providers)).toBe("deepseek");
  });

  it("falls back to lowest priority when node id missing or disabled", () => {
    expect(resolveScriptProviderId({}, providers)).toBe("deepseek");
    expect(resolveScriptProviderId({ providerId: "unknown" }, providers)).toBe("deepseek");
  });

  it("returns null when no providers", () => {
    expect(resolveScriptProviderId({ providerId: "openai" }, [])).toBe(null);
  });
});
