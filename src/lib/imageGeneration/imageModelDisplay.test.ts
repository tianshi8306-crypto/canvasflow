import { describe, expect, it } from "vitest";
import {
  imageModelEstimateLabel,
  imageModelIconLetter,
  imageModelSubtitle,
} from "./imageModelDisplay";

describe("imageModelDisplay", () => {
  it("builds subtitle from vendor and variant", () => {
    expect(
      imageModelSubtitle({
        vendorName: "Liblib",
        modelName: "x",
        modelVariant: "Nano Pro",
        model: "lib-nano",
      }),
    ).toBe("Liblib · Nano Pro");
  });

  it("uses estimate heuristics", () => {
    expect(
      imageModelEstimateLabel({
        model: "lib-nano-pro",
        modelVariant: "",
        label: "Lib Nano Pro",
      }),
    ).toBe("15s");
  });

  it("icon letter from vendor", () => {
    expect(imageModelIconLetter({ vendorName: "Seedream", label: "", model: "" })).toBe("S");
  });
});
