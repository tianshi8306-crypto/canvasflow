import { describe, expect, it } from "vitest";
import { emptyScriptBeat } from "./scriptBeatHelpers";
import {
  assembleStoryboardDraftFromBeats,
  patchFromScriptBeatsEdit,
  patchFromStoryboardDraftEdit,
} from "./storyboardDraftSync";

describe("storyboardDraftSync", () => {
  it("assembles draft from beats", () => {
    const draft = assembleStoryboardDraftFromBeats([
      {
        ...emptyScriptBeat(),
        episodeSceneShot: "1-1-01",
        rhythmTag: "建立",
        durationHint: "2.5秒",
        sceneHeading: "1-1日 外  cliff",
        shotSize: "全景",
        description: "悬崖切磋",
      },
    ]);
    expect(draft).toContain("---");
    expect(draft).toContain("1-1-01");
    expect(draft).toContain("悬崖切磋");
  });

  it("patchFromStoryboardDraftEdit syncs beats when parse ok", () => {
    const draft = `---
镜 1-1-01 · 建立 · 2.5s
场：1-1日 外 悬崖
时长：2.5秒
景别：全景
画面：测试画面
镜头运动：固定（平视）
台词：无
声音：环境声
剪辑重点：建立空间`;
    const patch = patchFromStoryboardDraftEdit(draft, []);
    expect(patch.scriptBeats?.length).toBe(1);
    expect(patch.storyboardDraft).toBe(draft);
    expect(patch.scriptBeats?.[0]?.storyboardPrompt).toContain("测试画面");
  });

  it("patchFromStoryboardDraftEdit reconciles legacy english storyboardPrompt", () => {
    const draft = `---
镜 1-1-01 · 建立 · 2.5s
画面：新画面
景别：全景
台词：无`;
    const patch = patchFromStoryboardDraftEdit(draft, [
      {
        ...emptyScriptBeat(),
        id: "keep-id",
        episodeSceneShot: "1-1-01",
        storyboardPrompt: "cinematic moody wide shot",
        seedancePositive: "cinematic moody wide shot",
      },
    ]);
    expect(patch.scriptBeats?.[0]?.id).toBe("keep-id");
    expect(patch.scriptBeats?.[0]?.seedancePositive).toBe("cinematic moody wide shot");
    expect(patch.scriptBeats?.[0]?.storyboardPrompt).toContain("新画面");
    expect(patch.scriptBeats?.[0]?.storyboardPrompt).not.toContain("cinematic");
  });

  it("patchFromStoryboardDraftEdit keeps beats when parse fails", () => {
    const patch = patchFromStoryboardDraftEdit("随便写点无效文本", [
      { ...emptyScriptBeat(), id: "x", description: "keep" },
    ]);
    expect(patch.scriptBeats).toBeUndefined();
    expect(patch.storyboardDraft).toBe("随便写点无效文本");
  });

  it("patchFromScriptBeatsEdit writes draft", () => {
    const beat = {
      ...emptyScriptBeat(),
      id: "b1",
      episodeSceneShot: "1-1-01",
      description: "画面A",
      durationHint: "2秒",
    };
    const patch = patchFromScriptBeatsEdit([beat], ["b1"]);
    expect(patch.storyboardDraft).toContain("画面A");
    expect(patch.scriptBeats?.[0]?.id).toBe("b1");
  });
});
