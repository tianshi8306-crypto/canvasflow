import { describe, expect, it } from "vitest";
import { defaultVideoGenerationDraft } from "@/lib/videoNodeTypes";
import {
  VIDEO_HD_PROMPT_SEED,
  VIDEO_PARSE_PROMPT_SEED,
  mergeDraftForVideoToolbarWorkflow,
} from "./videoToolbarWorkflow";

describe("mergeDraftForVideoToolbarWorkflow", () => {
  it("parse seeds prompt and reference video", () => {
    const next = mergeDraftForVideoToolbarWorkflow(
      defaultVideoGenerationDraft(),
      "assets/v.mp4",
      "parse",
    );
    expect(next.workflow).toBe("video_reference");
    expect(next.prompt).toBe(VIDEO_PARSE_PROMPT_SEED);
    expect(next.referenceVideoPaths).toEqual(["assets/v.mp4"]);
  });

  it("hd bumps resolution without overwriting existing prompt", () => {
    const base = { ...defaultVideoGenerationDraft(), prompt: "已有描述" };
    const next = mergeDraftForVideoToolbarWorkflow(base, "assets/v.mp4", "hd");
    expect(next.prompt).toBe("已有描述");
    expect(next.output.resolution).toBe("1080P");
    expect(next.prompt).not.toBe(VIDEO_HD_PROMPT_SEED);
  });

  it("hd seeds prompt when empty", () => {
    const next = mergeDraftForVideoToolbarWorkflow(
      defaultVideoGenerationDraft(),
      "assets/v.mp4",
      "hd",
    );
    expect(next.prompt).toBe(VIDEO_HD_PROMPT_SEED);
  });

  it("subtitle-auto enables noSubtitles on output", () => {
    const next = mergeDraftForVideoToolbarWorkflow(
      defaultVideoGenerationDraft(),
      "assets/v.mp4",
      "subtitle-auto",
    );
    expect(next.workflow).toBe("video_reference");
    expect(next.output.noSubtitles).toBe(true);
  });
});
