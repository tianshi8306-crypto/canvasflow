import { describe, expect, it } from "vitest";
import {
  buildConversationDigest,
  buildProjectContextSummary,
  extractUserConstraintsFromMessages,
  trimChatHistoryForLlm,
} from "@/lib/hermes/agent/hermesLongContext";
import type { HermesChatMessage } from "@/lib/hermes/hermesChatHistory";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

describe("hermesLongContext", () => {
  it("buildProjectContextSummary includes brief and beats", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          prompt: "赛博朋克雨夜追逐",
          scriptBeats: [
            { id: "b1", shotNumber: "1", description: "女主奔跑" },
            { id: "b2", shotNumber: "2", description: "霓虹巷口" },
          ] as FlowNodeData["scriptBeats"],
        },
      },
    ];
    const text = buildProjectContextSummary({
      nodes,
      edges: [],
      bible: null,
    });
    expect(text).toContain("赛博朋克");
    expect(text).toContain("镜 1");
    expect(text).toContain("女主奔跑");
  });

  it("trimChatHistoryForLlm keeps recent only", () => {
    const messages: HermesChatMessage[] = [];
    for (let i = 0; i < 20; i += 1) {
      messages.push({
        id: `m${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg-${i}`,
      });
    }
    const { history, olderForDigest } = trimChatHistoryForLlm(messages);
    expect(history.length).toBe(12);
    expect(olderForDigest.length).toBe(8);
    expect(history[0]?.content).toBe("msg-8");
  });

  it("buildConversationDigest compresses older turns", () => {
    const digest = buildConversationDigest([
      { id: "1", role: "user", content: "记住：全片竖屏 9:16" },
      { id: "2", role: "assistant", content: "好的" },
    ]);
    expect(digest).toContain("用户");
    expect(digest).toContain("竖屏");
  });

  it("extractUserConstraintsFromMessages", () => {
    const c = extractUserConstraintsFromMessages([
      { id: "1", role: "user", content: "记住：不要出现血腥画面" },
    ]);
    expect(c[0]).toContain("血腥");
  });
});
