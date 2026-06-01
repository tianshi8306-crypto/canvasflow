import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRef } from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import {
  VideoPromptMentionInput,
  type VideoPromptMentionInputRef,
} from "./VideoPromptMentionInput";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";

const refs: VideoIncomingRefItem[] = [
  { kind: "image", path: "a.png", y: 0, edgeId: "e1", sourceNodeId: "n1", nodeLabel: "图1" },
  { kind: "image", path: "b.png", y: 1, edgeId: "e2", sourceNodeId: "n2", nodeLabel: "图2" },
];

describe("VideoPromptMentionInput", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders thumbnail pills for @图片N tokens", () => {
    render(
      <VideoPromptMentionInput
        value="参考 @图片1 的动作"
        onChange={() => {}}
        incomingRefs={refs}
      />,
    );
    expect(document.querySelector(".mention-pill--with-media")).toBeInTheDocument();
    expect(document.querySelector(".mention-pill-thumb")).toBeInTheDocument();
    const pill = document.querySelector(".mention-pill--with-media");
    expect(pill?.className).toMatch(/mention-pill--density-/);
  });

  it("renders pills for {{Portrait N}} brace tokens with 图片N label", () => {
    render(
      <VideoPromptMentionInput
        value="角色 {{Portrait 4}} 动作"
        onChange={() => {}}
        incomingRefs={refs}
      />,
    );
    expect(document.querySelector(".mention-pill-label")?.textContent).toBe("图片4");
    expect(document.querySelector(".video-prompt-mention .mention-token-slot")).toBeInTheDocument();
  });

  it("downgrades density for short tokens without orphan badge", () => {
    render(
      <VideoPromptMentionInput
        value="参考 @a.png 预警"
        onChange={() => {}}
        incomingRefs={refs}
      />,
    );
    const pill = document.querySelector(".video-prompt-mention .mention-pill--with-media");
    expect(pill).toBeInTheDocument();
    expect(pill?.className).not.toContain("mention-pill--density-full");
    expect(pill?.querySelector(".seedanceComplianceBadge--pill")).not.toBeInTheDocument();
  });

  it("renders pills for @filename tokens", () => {
    render(
      <VideoPromptMentionInput
        value="参考 @b.png 的色调"
        onChange={() => {}}
        incomingRefs={refs}
      />,
    );
    expect(document.querySelector(".mention-pill--video-named")).toBeInTheDocument();
  });

  it("renders pills for wired @stem without extension", () => {
    const audioRefs: typeof refs = [
      { kind: "audio", path: "assets/背景音乐.mp3", y: 0, edgeId: "ea", sourceNodeId: "na", nodeLabel: "音频" },
    ];
    render(
      <VideoPromptMentionInput
        value="配乐 @背景音乐"
        onChange={() => {}}
        incomingRefs={audioRefs}
        displayNamesByEdge={new Map([["ea", "背景音乐"]])}
      />,
    );
    expect(document.querySelector(".mention-pill--video-named")).toBeInTheDocument();
  });

  it("opens anchored picker when typing @", async () => {
    const user = userEvent.setup();
    render(<VideoPromptMentionInput value="" onChange={() => {}} incomingRefs={refs} />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "@");
    await waitFor(() => {
      expect(document.querySelector(".video-at-picker")).toBeInTheDocument();
    });
    expect(document.querySelector(".video-at-picker__title")?.textContent).toBe("图片 1");
    expect(document.querySelector(".video-at-picker__shortcut")?.textContent).toBe("(@1)");
    expect(document.querySelector(".video-at-picker__shortcut")?.textContent).toBe("(@1)");
  });

  it("insertAtToken canonicalizes filename alias to @图片N", async () => {
    const onChange = vi.fn();
    function Wrapper() {
      const ref = useRef<VideoPromptMentionInputRef>(null);
      return (
        <>
          <VideoPromptMentionInput
            ref={ref}
            value="hello"
            onChange={onChange}
            incomingRefs={refs}
          />
          <button type="button" onClick={() => ref.current?.insertAtToken("@b.png")}>
            insert
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole("button", { name: "insert" }));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("@图片2"));
  });

  it("normalizes alias tokens on blur", async () => {
    const onChange = vi.fn();
    render(
      <VideoPromptMentionInput
        value="参考 @b.png 动作"
        onChange={onChange}
        incomingRefs={refs}
      />,
    );
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    textarea.blur();
    expect(onChange).toHaveBeenCalledWith("参考 @图片2 动作");
  });

  it("Backspace removes entire @图片N token in one keypress", async () => {
    const onChange = vi.fn();
    render(
      <VideoPromptMentionInput
        value="参考 @图片1 动作"
        onChange={onChange}
        incomingRefs={refs}
      />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(7, 7);
    await userEvent.setup().keyboard("{Backspace}");
    expect(onChange).toHaveBeenCalledWith("参考  动作");
  });
});
