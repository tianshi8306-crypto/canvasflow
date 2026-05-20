import { describe, expect, it } from "vitest";
import {
  AUDIO_NODE_HEIGHT,
  AUDIO_NODE_WIDTH,
  computeAudioNodeFrameSize,
} from "@/lib/audioNodeFrameSize";
import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_WIDTH,
  computeTextNodeFrameSize,
} from "@/lib/textNodeChrome";

describe("audioNodeFrameSize", () => {
  it("default matches text node chrome", () => {
    expect(AUDIO_NODE_WIDTH).toBe(TEXT_NODE_CHROME_WIDTH);
    expect(AUDIO_NODE_HEIGHT).toBe(TEXT_NODE_CHROME_HEIGHT_EMPTY);
    expect(computeAudioNodeFrameSize()).toEqual(
      computeTextNodeFrameSize({ hasBody: false }),
    );
  });

  it("persists chrome size like text node", () => {
    const w = TEXT_NODE_CHROME_WIDTH + 40;
    const h = TEXT_NODE_CHROME_HEIGHT_EMPTY + 20;
    expect(computeAudioNodeFrameSize({ chromeWidth: w, chromeHeight: h })).toEqual(
      computeTextNodeFrameSize({ hasBody: false, chromeWidth: w, chromeHeight: h }),
    );
  });
});
