import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ImagePromptMentionInput } from "./ImagePromptMentionInput";
import type { ResolvedIncomingImageRef } from "@/lib/imageGeneration/types";

const refs: ResolvedIncomingImageRef[] = [
  {
    kind: "image",
    edgeId: "e1",
    sourceNodeId: "n1",
    nodeLabel: "图片1",
    path: "assets/a.png",
    resolvedPath: "/proj/assets/a.png",
    y: 0,
  },
  {
    kind: "image",
    edgeId: "e2",
    sourceNodeId: "n2",
    nodeLabel: "图片2",
    path: "assets/b.png",
    resolvedPath: "/proj/assets/b.png",
    y: 1,
  },
];

describe("ImagePromptMentionInput", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders thumbnail pills for @图片N tokens with full label", () => {
    render(
      <ImagePromptMentionInput
        value="参考 @图片1 的构图"
        onChange={() => {}}
        incomingRefs={refs}
      />,
    );
    expect(document.querySelector(".mention-pill--with-media")).toBeInTheDocument();
    expect(document.querySelector(".mention-pill-thumb")).toBeInTheDocument();
    expect(document.querySelector(".mention-pill-label")?.textContent).toMatch(/图1$/);
  });

  it("renders style pill without thumb", () => {
    render(
      <ImagePromptMentionInput
        value="#[style:cinematic] 人像"
        onChange={() => {}}
        incomingRefs={refs}
      />,
    );
    expect(document.querySelector(".mention-pill--style")).toBeInTheDocument();
    expect(document.querySelector(".mention-pill-thumb")).not.toBeInTheDocument();
  });

  it("marks active pill when activeRefSourceNodeId matches", () => {
    render(
      <ImagePromptMentionInput
        value="参考 @图片2"
        onChange={() => {}}
        incomingRefs={refs}
        activeRefSourceNodeId="n2"
      />,
    );
    expect(document.querySelector(".mention-pill--ref-active")).toBeInTheDocument();
  });
});
