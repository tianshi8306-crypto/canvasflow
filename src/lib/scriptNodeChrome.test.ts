import { describe, expect, it } from "vitest";
import {
  SCRIPT_NODE_MIN_HEIGHT_EMPTY,
  SCRIPT_NODE_SHELL_WIDTH,
  computeScriptNodeFrameSize,
} from "@/lib/scriptNodeChrome";
import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_WIDTH,
} from "@/lib/textNodeChrome";

describe("scriptNodeChrome", () => {
  it("preview shell matches text node default frame", () => {
    expect(SCRIPT_NODE_SHELL_WIDTH).toBe(TEXT_NODE_CHROME_WIDTH);
    expect(SCRIPT_NODE_MIN_HEIGHT_EMPTY).toBe(TEXT_NODE_CHROME_HEIGHT_EMPTY);
    expect(computeScriptNodeFrameSize(false, 0)).toEqual({
      width: TEXT_NODE_CHROME_WIDTH,
      height: TEXT_NODE_CHROME_HEIGHT_EMPTY,
    });
    expect(computeScriptNodeFrameSize(true, 12)).toEqual({
      width: TEXT_NODE_CHROME_WIDTH,
      height: TEXT_NODE_CHROME_HEIGHT_EMPTY,
    });
  });
});
