import { describe, expect, it } from "vitest";
import {
  isHermesProfileIntent,
  isHermesTeachIntent,
  parseHermesProfilePayload,
  parseHermesTeachPayload,
} from "@/lib/hermes/knowledge/hermesMemoryIntent";

describe("hermesMemoryIntent", () => {
  it("解析记住：后的正文", () => {
    expect(parseHermesTeachPayload("记住：TTS 用四层表演描述，不要悲伤地说")).toBe(
      "TTS 用四层表演描述，不要悲伤地说",
    );
  });

  it("识别教给 Hermes", () => {
    expect(isHermesTeachIntent("教给你：竖屏 5 秒竖屏参数")).toBe(true);
  });

  it("普通聊天不命中", () => {
    expect(isHermesTeachIntent("帮我把分镜出图")).toBe(false);
    expect(parseHermesTeachPayload("帮我把分镜出图")).toBeNull();
  });

  it("仅有记住前缀时返回空串", () => {
    expect(parseHermesTeachPayload("请记住")).toBe("");
    expect(isHermesTeachIntent("请记住")).toBe(true);
  });

  it("解析用户画像指令", () => {
    expect(parseHermesProfilePayload("画像：竖屏 9:16，节奏快")).toContain("竖屏");
    expect(isHermesProfileIntent("更新画像：不要血腥")).toBe(true);
    expect(isHermesTeachIntent("画像：竖屏")).toBe(false);
  });
});
