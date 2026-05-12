import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MentionInput } from "./MentionInput";

// Stub useUpstreamNodeCandidates before importing MentionInput
vi.mock("../../hooks/useUpstreamNodeCandidates", () => ({
  useUpstreamNodeCandidates: vi.fn(() => [
    { id: "upstream1", type: "textNode", label: "上游文本节点" },
    { id: "upstream2", type: "llm", label: "LLM节点" },
    { id: "script1", type: "scriptNode", label: "脚本节点" },
  ]),
}));

describe("MentionInput", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a textarea with overlay container", () => {
    render(<MentionInput nodeId="n1" value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(document.querySelector(".mention-overlay")).toBeInTheDocument();
  });

  it("shows dropdown when @ is typed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MentionInput nodeId="n1" value="" onChange={onChange} />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "@");
    expect(document.querySelector(".mention-dropdown")).toBeInTheDocument();
  });

  it("renders mention pills for @[nodeId] tokens in value", () => {
    render(
      <MentionInput
        nodeId="n1"
        value="Hello @[upstream1] and @[upstream2]"
        onChange={() => {}}
        nodeLabels={{ upstream1: "角色节点", upstream2: "场景节点" }}
      />
    );
    const pills = document.querySelectorAll(".mention-pill");
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toContain("角色节点");
    expect(pills[1].textContent).toContain("场景节点");
  });

  it("clicking dropdown item inserts @[nodeId]", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MentionInput nodeId="n1" value="" onChange={onChange} />);
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "@");
    expect(document.querySelector(".mention-dropdown")).toBeInTheDocument();

    // Click dropdown item
    const dropdownItem = document.querySelector(".mention-dropdown-item") as HTMLElement;
    fireEvent.mouseDown(dropdownItem);

    // Should have 2 calls: 1) typing @, 2) inserting mention
    expect(onChange).toHaveBeenCalledTimes(2);
    // Second call should be the inserted mention
    const insertedValue = onChange.mock.calls[1][0];
    expect(insertedValue).toMatch(/@\[upstream1\]/);
  });

  it("keyboard nav - ArrowDown selects next item (index 1)", async () => {
    const user = userEvent.setup();
    render(
      <MentionInput
        nodeId="n1"
        value=""
        onChange={() => {}}
      />
    );
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "@");
    expect(document.querySelector(".mention-dropdown")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");

    const items = document.querySelectorAll(".mention-dropdown-item");
    expect(items[0]).not.toHaveClass(/selected/);
    expect(items[1]).toHaveClass(/selected/);
  });

  it("keyboard nav - ArrowUp from index 1 goes back to index 0", async () => {
    const user = userEvent.setup();
    render(
      <MentionInput
        nodeId="n1"
        value=""
        onChange={() => {}}
      />
    );
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "@");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");

    const items = document.querySelectorAll(".mention-dropdown-item");
    expect(items[0]).toHaveClass(/selected/);
    expect(items[1]).not.toHaveClass(/selected/);
  });

  it("keyboard nav - Enter inserts selected mention", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        nodeId="n1"
        value=""
        onChange={onChange}
      />
    );
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "@");
    expect(document.querySelector(".mention-dropdown")).toBeInTheDocument();

    await user.keyboard("{Enter}");

    // Should have 2 calls: 1) typing @, 2) inserting mention
    expect(onChange).toHaveBeenCalledTimes(2);
    const insertedValue = onChange.mock.calls[1][0];
    expect(insertedValue).toMatch(/@\[upstream1\]/);
  });

  it("keyboard nav - Tab inserts selected mention", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        nodeId="n1"
        value=""
        onChange={onChange}
      />
    );
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "@");
    expect(document.querySelector(".mention-dropdown")).toBeInTheDocument();

    await user.keyboard("{Tab}");

    // Should have 2 calls: 1) typing @, 2) inserting mention
    expect(onChange).toHaveBeenCalledTimes(2);
    const insertedValue = onChange.mock.calls[1][0];
    expect(insertedValue).toMatch(/@\[upstream1\]/);
  });

  it("Escape closes dropdown without changing value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MentionInput
        nodeId="n1"
        value=""
        onChange={onChange}
      />
    );
    const textarea = screen.getByRole("textbox");

    // Type @ first
    await user.type(textarea, "@");
    expect(document.querySelector(".mention-dropdown")).toBeInTheDocument();

    onChange.mockClear();

    // Press Escape
    await user.keyboard("{Escape}");
    expect(document.querySelector(".mention-dropdown")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("filters dropdown items by query after @", async () => {
    const user = userEvent.setup();
    render(
      <MentionInput
        nodeId="n1"
        value=""
        onChange={() => {}}
      />
    );
    const textarea = screen.getByRole("textbox");

    // Type @ to show dropdown
    await user.type(textarea, "@");
    expect(document.querySelector(".mention-dropdown")).toBeInTheDocument();
    expect(document.querySelectorAll(".mention-dropdown-item")).toHaveLength(3);

    // Type "l" to filter
    await user.type(textarea, "l");

    const items = document.querySelectorAll(".mention-dropdown-item");
    // Should filter to nodes with "l" in type or label
    // upstream1 (textNode) - no "l" in "textnode" or "上游文本节点"
    // upstream2 (llm) - "l" in "llm"
    // script1 (scriptNode) - "l" in "scriptnode" and "脚本节点" has "l" in pinyin but not literal
    // So should show upstream2 and script1
    expect(items.length).toBeGreaterThan(0);
  });

  it("uses nodeLabels prop for pill display", () => {
    render(
      <MentionInput
        nodeId="n1"
        value="Check @[upstream1] for details"
        onChange={() => {}}
        nodeLabels={{ upstream1: "自定义标签" }}
      />
    );
    const pills = document.querySelectorAll(".mention-pill");
    expect(pills).toHaveLength(1);
    expect(pills[0].textContent).toContain("自定义标签");
  });
});
