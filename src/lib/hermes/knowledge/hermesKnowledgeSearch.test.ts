import { describe, expect, it } from "vitest";
import {
  pickHermesKnowledgeSceneForChat,
  pickHermesKnowledgeScenesForChat,
} from "@/lib/hermes/knowledge/hermesKnowledgeSearch";

describe("pickHermesKnowledgeSceneForChat", () => {
  it("排障类问题", () => {
    expect(pickHermesKnowledgeSceneForChat("视频生成失败怎么排障")).toBe("troubleshoot");
  });

  it("参数类问题", () => {
    expect(pickHermesKnowledgeSceneForChat("Seedance 竖屏 5 秒怎么设")).toBe("param");
  });

  it("分镜写法", () => {
    expect(pickHermesKnowledgeSceneForChat("分镜 visualPrompt 怎么写")).toBe("creative");
  });

  it("配音/TTS 走 creative", () => {
    expect(pickHermesKnowledgeSceneForChat("女主悲伤地说 怎么写 TTS")).toBe("creative");
  });

  it("人物动作视频提示词走 creative", () => {
    expect(pickHermesKnowledgeSceneForChat("图生视频人物动作提示词模板")).toBe("creative");
  });

  it("普通寒暄不检索", () => {
    expect(pickHermesKnowledgeSceneForChat("你好")).toBeNull();
  });

  it("顾问模式默认检索电影通识", () => {
    expect(pickHermesKnowledgeScenesForChat("你好", { advisorMode: true })).toContain(
      "film_theory",
    );
  });

  it("蒙太奇问题含 film_theory", () => {
    expect(pickHermesKnowledgeScenesForChat("什么是蒙太奇")).toContain("film_theory");
  });
});
