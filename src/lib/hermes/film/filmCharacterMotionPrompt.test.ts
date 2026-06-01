import { describe, expect, it } from "vitest";
import {
  shouldUseMotionTemplate,
  wantsCharacterMotionVideoPrompt,
} from "@/lib/hermes/film/filmCharacterMotionPrompt";
import { buildDirectorPlan } from "@/lib/hermes/hermesPlanFromIntent";

describe("filmCharacterMotionPrompt", () => {
  it("detects motion video prompt intent", () => {
    expect(wantsCharacterMotionVideoPrompt("帮写人物动作视频提示词")).toBe(true);
    expect(wantsCharacterMotionVideoPrompt("什么是 Seedance")).toBe(false);
  });

  it("shouldUseMotionTemplate from message or args", () => {
    expect(shouldUseMotionTemplate("补全图生视频动作描述", undefined)).toBe(true);
    expect(shouldUseMotionTemplate("", { useMotionTemplate: true })).toBe(true);
    expect(shouldUseMotionTemplate("你好", undefined)).toBe(false);
  });
});

describe("buildDirectorPlan motion", () => {
  const ctx = {
    projectPath: "/p",
    scriptNodeId: "s1",
    beatCount: 3,
    storyboardReadyCount: 3,
    hasBrief: true,
    beatIds: ["b1", "b2", "b3"],
  };

  it("plans shot_to_video with useMotionTemplate", () => {
    const plan = buildDirectorPlan("按人物动作模板补全各镜视频提示词", ctx);
    expect(plan?.steps[0]?.toolId).toBe("film.shot_to_video_prompt");
    expect(plan?.steps[0]?.args?.useMotionTemplate).toBe(true);
  });

  it("prepends motion fill before batch video", () => {
    const plan = buildDirectorPlan("帮我把已出图的镜头批量出视频", ctx);
    const tools = plan?.steps.map((s) => s.toolId) ?? [];
    const motionIdx = tools.indexOf("film.shot_to_video_prompt");
    const videoIdx = tools.indexOf("video.generate_for_beats");
    expect(motionIdx).toBeGreaterThanOrEqual(0);
    expect(videoIdx).toBeGreaterThan(motionIdx);
  });
});
