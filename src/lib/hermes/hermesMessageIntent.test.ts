import { describe, expect, it } from "vitest";
import {
  hasHermesConsultIntent,
  resolveHermesMessageMode,
  shouldRunDirectorPlan,
} from "@/lib/hermes/hermesMessageIntent";

describe("hermesMessageIntent", () => {
  it("纯咨询不走导演", () => {
    expect(resolveHermesMessageMode("什么是蒙太奇？")).toBe("consult");
    expect(shouldRunDirectorPlan("consult")).toBe(false);
  });

  it("添加文本节点走执行通道", () => {
    expect(
      resolveHermesMessageMode("不是咨询 你现在在画布上添加一个文本节点"),
    ).toBe("execute");
  });

  it("纯执行走导演", () => {
    expect(resolveHermesMessageMode("分镜出图")).toBe("execute");
    expect(shouldRunDirectorPlan("execute")).toBe(true);
  });

  it("混合意图", () => {
    expect(
      resolveHermesMessageMode("参考《银翼杀手》的霓虹雨夜，帮我把 1-3 镜出图"),
    ).toBe("mixed");
  });

  it("咨询信号", () => {
    expect(hasHermesConsultIntent("推荐几部科幻电影")).toBe(true);
    expect(hasHermesConsultIntent("分镜出图")).toBe(false);
  });
});
