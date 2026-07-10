import { describe, expect, it } from "vitest";
import { emptyScriptBeat } from "./scriptBeatHelpers";
import { syncScriptBeatsFromDraft } from "./syncScriptBeatsFromDraft";

const SAMPLE = `---
镜 1-1-01 · 建立 · 2.5s
场：1-1日 外 悬崖
时长：2.5秒
景别：全景
画面：悬崖边师徒切磋
镜头运动：缓慢推（平视）
台词：无
声音：环境声
剪辑重点：建立空间

---
镜 1-1-02 · 推进 · 2.0s
场：1-1日 外 悬崖
时长：2.0秒
景别：近景
画面：陈南出掌
镜头运动：固定（平视）
台词：陈南：师父！
声音：环境声
剪辑重点：硬切`;

describe("syncScriptBeatsFromDraft", () => {
  it("parses blocks into beats", () => {
    const r = syncScriptBeatsFromDraft(SAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsedCount).toBe(2);
    expect(r.beats[0].episodeSceneShot).toBe("1-1-01");
    expect(r.beats[0].shotSize).toBe("全景");
    expect(r.beats[0].description).toContain("切磋");
    expect(r.beats[1].dialogue).toContain("陈南");
  });

  it("preserves existing beat id by shot key", () => {
    const r = syncScriptBeatsFromDraft(SAMPLE, [
      {
        ...emptyScriptBeat(),
        id: "keep-me",
        shotId: "keep-me",
        episodeSceneShot: "1-1-01",
        shotNumber: "1-1-01",
        description: "old",
        storyboardPrompt: "seedance prompt",
      },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beats[0].id).toBe("keep-me");
    expect(r.beats[0].storyboardPrompt).toBe("seedance prompt");
    expect(r.beats[0].description).toContain("切磋");
  });

  it("parses lightingMood from draft block", () => {
    const draft = `---
镜 1-1-01 · 建立 · 2.5s
景别：全景
光影：冷色侧光
画面：测试
台词：无`;
    const r = syncScriptBeatsFromDraft(draft, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.beats[0]?.lightingMood).toBe("冷色侧光");
  });

  it("fails on empty draft", () => {
    const r = syncScriptBeatsFromDraft("  ");
    expect(r.ok).toBe(false);
  });
});
