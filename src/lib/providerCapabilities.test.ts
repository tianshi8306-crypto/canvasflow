import { describe, expect, it } from "vitest";
import { providerSupportsCapability } from "./providerCapabilities";

describe("providerCapabilities", () => {
  it("openai supports chat and audio", () => {
    expect(providerSupportsCapability("openai", "chat")).toBe(true);
    expect(providerSupportsCapability("openai", "audio")).toBe(true);
    expect(providerSupportsCapability("openai", "image")).toBe(false);
  });

  it("dreamina supports image and video only", () => {
    expect(providerSupportsCapability("dreamina", "chat")).toBe(false);
    expect(providerSupportsCapability("dreamina", "image")).toBe(true);
    expect(providerSupportsCapability("dreamina", "video")).toBe(true);
  });
});
