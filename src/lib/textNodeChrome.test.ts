import { describe, expect, it } from "vitest";
import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_MAX_HEIGHT,
  TEXT_NODE_CHROME_MAX_WIDTH,
  TEXT_NODE_CHROME_WIDTH,
  computeTextNodeFrameSize,
} from "@/lib/textNodeChrome";

describe("textNodeChrome resize bounds", () => {
  it("default size is below max so user can enlarge", () => {
    expect(TEXT_NODE_CHROME_MAX_WIDTH).toBeGreaterThan(TEXT_NODE_CHROME_WIDTH);
    expect(TEXT_NODE_CHROME_MAX_HEIGHT).toBeGreaterThan(TEXT_NODE_CHROME_HEIGHT_EMPTY);
  });

  it("persists chrome size above default when within max", () => {
    const size = computeTextNodeFrameSize({
      hasBody: true,
      chromeWidth: TEXT_NODE_CHROME_MAX_WIDTH,
      chromeHeight: TEXT_NODE_CHROME_MAX_HEIGHT,
    });
    expect(size.width).toBe(TEXT_NODE_CHROME_MAX_WIDTH);
    expect(size.height).toBe(TEXT_NODE_CHROME_MAX_HEIGHT);
  });
});
