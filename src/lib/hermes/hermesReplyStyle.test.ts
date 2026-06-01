import { describe, expect, it } from "vitest";
import { inferHermesReplyStyle } from "@/lib/hermes/hermesReplyStyle";

describe("inferHermesReplyStyle", () => {
  it("execute canvas ops stay concise", () => {
    expect(
      inferHermesReplyStyle({
        userMessage: "不是咨询，在画布上添加一个文本节点",
        messageMode: "execute",
        planStepCount: 1,
      }),
    ).toBe("concise");
  });

  it("deep consult expands", () => {
    expect(
      inferHermesReplyStyle({
        userMessage: "请解释一下蒙太奇和跳切在悬疑片里有什么区别？",
        messageMode: "consult",
      }),
    ).toBe("detailed");
  });

  it("mixed uses standard unless deep question", () => {
    expect(
      inferHermesReplyStyle({
        userMessage: "参考银翼杀手霓虹感，帮 1-3 镜出图",
        messageMode: "mixed",
      }),
    ).toBe("standard");
  });
});
