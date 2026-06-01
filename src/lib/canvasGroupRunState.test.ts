import { describe, expect, it } from "vitest";
import { aggregateGroupRunState } from "@/lib/canvasGroupRunState";

describe("aggregateGroupRunState", () => {
  it("returns idle when no member states", () => {
    expect(aggregateGroupRunState(["a", "b"], {})).toBe("idle");
  });

  it("prioritizes running", () => {
    expect(
      aggregateGroupRunState(["a", "b"], { a: "succeeded", b: "running" }),
    ).toBe("running");
  });

  it("detects failed", () => {
    expect(aggregateGroupRunState(["a"], { a: "failed" })).toBe("failed");
  });

  it("detects partial", () => {
    expect(
      aggregateGroupRunState(["a", "b"], { a: "succeeded", b: "skipped" }),
    ).toBe("succeeded");
    expect(
      aggregateGroupRunState(["a", "b"], { a: "succeeded", b: "failed" }),
    ).toBe("failed");
  });
});
