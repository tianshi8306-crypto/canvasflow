import { describe, expect, it } from "vitest";
import {
  AUDIO_NODE_HEIGHT,
  AUDIO_NODE_WIDTH,
  computeAudioNodeFrameSize,
} from "@/lib/audioNodeFrameSize";
import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_WIDTH,
} from "@/lib/textNodeChrome";

describe("audioNodeFrameSize", () => {
  it("default matches text node preview shell", () => {
    expect(AUDIO_NODE_WIDTH).toBe(TEXT_NODE_CHROME_WIDTH);
    expect(AUDIO_NODE_HEIGHT).toBe(TEXT_NODE_CHROME_HEIGHT_EMPTY);
  });

  it("computeAudioNodeFrameSize returns fixed text-aligned size", () => {
    expect(computeAudioNodeFrameSize()).toEqual({
      width: AUDIO_NODE_WIDTH,
      height: AUDIO_NODE_HEIGHT,
    });
  });
});
