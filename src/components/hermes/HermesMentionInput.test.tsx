import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { HermesMentionInput } from "./HermesMentionInput";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

const nodes: Node<FlowNodeData>[] = [
  {
    id: "img1",
    type: "imageAsset",
    position: { x: 0, y: 0 },
    data: { label: "定妆", path: "assets/test.png" } as FlowNodeData,
  },
];

describe("HermesMentionInput", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("stacks mirror overlay and textarea in one grid cell", () => {
    render(
      <HermesMentionInput value="参考 @图1 色调" onChange={() => {}} nodes={nodes} />,
    );
    const wrapper = document.querySelector(".hermes-mention-input.mention-input-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(document.querySelector(".mention-overlay.hermes-mention-overlay")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveClass("mention-textarea", "hermesFloatInput");
  });

  it("renders hermes mention pills", () => {
    render(
      <HermesMentionInput value="参考 @图1 色调" onChange={() => {}} nodes={nodes} />,
    );
    expect(document.querySelector(".mention-pill--hermes-ref")).toBeInTheDocument();
  });

  it("Backspace removes entire @ token in one keypress", async () => {
    const onChange = vi.fn();
    render(
      <HermesMentionInput
        value="参考 @图1 色调"
        onChange={onChange}
        nodes={nodes}
      />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(6, 6);
    await userEvent.setup().keyboard("{Backspace}");
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0] as string;
    expect(last).not.toContain("@图1");
  });

  it("opens picker when typing @", async () => {
    const user = userEvent.setup();
    render(<HermesMentionInput value="" onChange={() => {}} nodes={nodes} />);
    await user.type(screen.getByRole("textbox"), "@");
    await waitFor(() => {
      expect(document.querySelector(".hermes-mention-picker")).toBeInTheDocument();
    });
  });
});
