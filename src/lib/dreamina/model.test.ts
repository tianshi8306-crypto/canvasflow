import { describe, expect, it } from "vitest";
import { normalizeDreaminaCliModelVersion } from "./model";

describe("normalizeDreaminaCliModelVersion", () => {
  it("maps underscore aliases to CLI canonical values", () => {
    expect(normalizeDreaminaCliModelVersion("3.0_fast")).toBe("3.0fast");
    expect(normalizeDreaminaCliModelVersion("3.0_pro")).toBe("3.0pro");
    expect(normalizeDreaminaCliModelVersion("3.5_pro")).toBe("3.5pro");
  });
});
