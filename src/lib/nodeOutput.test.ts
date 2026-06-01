import { describe, it, expect } from "vitest";
import { parseNodeMediaOutput } from "./nodeOutput";

describe("parseNodeMediaOutput", () => {
  it("parses M3 JSON envelope", () => {
    expect(
      parseNodeMediaOutput(JSON.stringify({ relPath: "assets/a.png", assetId: "uuid-1" })),
    ).toEqual({ relPath: "assets/a.png", assetId: "uuid-1" });
  });

  it("parses legacy plain path", () => {
    expect(parseNodeMediaOutput("assets/legacy.mp4")).toEqual({ relPath: "assets/legacy.mp4" });
  });
});
