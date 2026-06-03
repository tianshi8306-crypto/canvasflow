import { describe, it, expect } from "vitest";
import { resolveMentionTokens } from "./resolveMentionTokens";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "./types";

describe("resolveMentionTokens", () => {
  const mockNodes: Node<FlowNodeData>[] = [
    {
      id: "node-1",
      type: "textNode",
      data: { label: "My Text Node", prompt: "Hello world" },
      position: { x: 0, y: 0 },
    },
    {
      id: "node-2",
      type: "textNode",
      data: { label: "Empty Node", prompt: "" },
      position: { x: 0, y: 0 },
    },
    {
      id: "node-3",
      type: "textNode",
      data: { label: "Output Node", output: "Some output content" },
      position: { x: 0, y: 0 },
    },
  ];

  it("passes through text with no tokens", () => {
    const input = "This is plain text with no mentions.";
    const result = resolveMentionTokens(input, mockNodes);
    expect(result).toBe("This is plain text with no mentions.");
  });

  it("replaces @[nodeId] with label and content", () => {
    const input = "Check out @[node-1] for details.";
    const result = resolveMentionTokens(input, mockNodes);
    expect(result).toBe("Check out [My Text Node: Hello world] for details.");
  });

  it("falls back to nodeId if node not found (returns match unchanged)", () => {
    const input = "Missing @[nonexistent] node.";
    const result = resolveMentionTokens(input, mockNodes);
    expect(result).toBe("Missing @[nonexistent] node.");
  });

  it("falls back to label if prompt empty", () => {
    const input = "Empty @[node-2] here.";
    const result = resolveMentionTokens(input, mockNodes);
    expect(result).toBe("Empty [Empty Node: （空）] here.");
  });

  it("handles multiple mention tokens in one string", () => {
    const input = "First @[node-1] and second @[node-3] and missing @[unknown].";
    const result = resolveMentionTokens(input, mockNodes);
    expect(result).toBe(
      "First [My Text Node: Hello world] and second [Output Node: （空）] and missing @[unknown].",
    );
  });
});
