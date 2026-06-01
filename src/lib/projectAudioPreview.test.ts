import { describe, expect, it } from "vitest";
import {
  audioExtFromRelPath,
  prefersAssetPlayback,
  AUDIO_ASSET_PLAYBACK_EXTS,
} from "@/lib/projectAudioPreview";

describe("projectAudioPreview", () => {
  it("detects extension from rel path", () => {
    expect(audioExtFromRelPath("assets/voice.mp3")).toBe("mp3");
    expect(audioExtFromRelPath("assets\\clip.WAV")).toBe("wav");
  });

  it("mp3 uses asset playback strategy", () => {
    expect(prefersAssetPlayback("assets/a.mp3")).toBe(true);
    expect(prefersAssetPlayback("assets/a.wav")).toBe(false);
    expect(AUDIO_ASSET_PLAYBACK_EXTS.has("mp3")).toBe(true);
  });
});
