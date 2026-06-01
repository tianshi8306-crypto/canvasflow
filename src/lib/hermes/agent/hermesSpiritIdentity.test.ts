import { describe, expect, it } from "vitest";
import {
  buildSpiritFirstIntro,
  formatSpiritIdentityForPrompt,
  parseSpiritNamePayload,
  parseUserHonorificPayload,
  resolveSpiritDisplayName,
  resolveSpiritShortMark,
} from "@/lib/hermes/agent/hermesSpiritIdentity";
import { HERMES_SPIRIT_DEFAULT_NAME } from "@/lib/hermes/hermesAgentIdentity";

describe("hermesSpiritIdentity", () => {
  it("parses spirit rename intents", () => {
    expect(parseSpiritNamePayload("你叫小蓝")).toBe("小蓝");
    expect(parseSpiritNamePayload("灵体名字叫 阿青")).toBe("阿青");
    expect(parseSpiritNamePayload("帮第 2 镜出图")).toBeNull();
  });

  it("parses user honorific intents", () => {
    expect(parseUserHonorificPayload("叫我老板")).toBe("老板");
    expect(parseUserHonorificPayload("你叫我阿凡就行")).toBe("阿凡");
    expect(parseUserHonorificPayload("叫我帮你出图")).toBeNull();
  });

  it("first intro avoids Hermes branding", () => {
    const intro = buildSpiritFirstIntro({
      spiritName: "",
      userHonorific: "",
      introShown: false,
    });
    expect(intro).not.toMatch(/Hermes/i);
    expect(intro).toContain("灵体");
  });

  it("prompt block forbids Hermes self-intro", () => {
    const block = formatSpiritIdentityForPrompt({
      spiritName: "小蓝",
      userHonorific: "老板",
      introShown: true,
    });
    expect(block).toContain("小蓝");
    expect(block).toContain("老板");
    expect(block).toContain("禁止");
  });

  it("defaults display name and short mark", () => {
    const identity = { spiritName: "", userHonorific: "", introShown: false };
    expect(resolveSpiritDisplayName(identity)).toBe(HERMES_SPIRIT_DEFAULT_NAME);
    expect(resolveSpiritShortMark(identity)).toBe("灵");
    expect(resolveSpiritShortMark({ ...identity, spiritName: "小蓝" })).toBe("小蓝");
  });
});
