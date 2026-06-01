import { describe, expect, it } from "vitest";
import { formatDurationSec } from "./formatDuration";

describe("formatDurationSec", () => {
  it("formats mm:ss", () => {
    expect(formatDurationSec(65)).toBe("01:05");
    expect(formatDurationSec(0)).toBe("00:00");
  });
});
