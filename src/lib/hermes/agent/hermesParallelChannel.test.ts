import { describe, expect, it } from "vitest";
import {
  canSubmitHermesMessage,
  isHermesConsultChannel,
} from "@/lib/hermes/agent/hermesParallelChannel";

describe("hermesParallelChannel", () => {
  it("consult allowed while streaming", () => {
    expect(isHermesConsultChannel("consult")).toBe(true);
    expect(
      canSubmitHermesMessage({
        messageMode: "consult",
        streaming: true,
        planning: false,
      }),
    ).toBe(true);
  });

  it("execute allowed while streaming for enqueue", () => {
    expect(
      canSubmitHermesMessage({
        messageMode: "execute",
        streaming: true,
        planning: false,
      }),
    ).toBe(true);
  });

  it("execute allowed while planning (queued by sidebar)", () => {
    expect(
      canSubmitHermesMessage({
        messageMode: "execute",
        streaming: false,
        planning: true,
      }),
    ).toBe(true);
  });
});
