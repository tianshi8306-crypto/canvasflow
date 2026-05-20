import { describe, expect, it } from "vitest";
import { defaultVideoSourceTrim, normalizeVideoSourceTrim } from "./videoSourceTrim";

describe("videoSourceTrim", () => {
  it("defaults to full duration", () => {
    expect(defaultVideoSourceTrim(12)).toEqual({ inSec: 0, outSec: 12 });
  });

  it("clamps invalid ranges", () => {
    expect(normalizeVideoSourceTrim({ inSec: -1, outSec: 20 }, 10)).toEqual({
      inSec: 0,
      outSec: 10,
    });
  });
});
