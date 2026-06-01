import { describe, it, expect } from "vitest";
import {
  collectVideoPromptRefTokenRanges,
  getAtomicRefTokenDeletion,
  mapPromptCursorAfterSegmentReplace,
} from "./videoPromptMentionEditing";

describe("videoPromptMentionEditing", () => {
  it("collects ref token ranges", () => {
    const ranges = collectVideoPromptRefTokenRanges("参考 @图片1 动作");
    expect(ranges).toEqual([{ start: 3, end: 7 }]);
  });

  it("Backspace inside @图片1 deletes whole token", () => {
    const prompt = "参考 @图片1 动作";
    const tokenEnd = 7;
    expect(getAtomicRefTokenDeletion(prompt, tokenEnd, tokenEnd, "Backspace")).toEqual({
      start: 3,
      end: 7,
    });
    expect(getAtomicRefTokenDeletion(prompt, 5, 5, "Backspace")).toEqual({
      start: 3,
      end: 7,
    });
  });

  it("Delete at token start removes whole token", () => {
    const prompt = "参考 @图片1 动作";
    expect(getAtomicRefTokenDeletion(prompt, 3, 3, "Delete")).toEqual({
      start: 3,
      end: 7,
    });
  });

  it("does not treat plain @ query as atomic token", () => {
    expect(getAtomicRefTokenDeletion("hello @b", 7, 7, "Backspace")).toBeNull();
  });

  it("maps cursor after alias normalize on blur", () => {
    const old = "参考 @b.png 动作";
    const next = "参考 @图片2 动作";
    const cursorAtEndOfAlias = 9;
    const mapped = mapPromptCursorAfterSegmentReplace(old, next, cursorAtEndOfAlias);
    expect(mapped).toBe(7);
    expect(next.slice(0, mapped)).toBe("参考 @图片2");
  });
});
