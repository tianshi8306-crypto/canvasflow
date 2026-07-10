import { ScriptBeatsScalarFieldCell } from "@/components/ScriptBeatsScalarFieldCell";
import { ScriptBasicDisplayEditCell } from "@/components/script/ScriptBasicDisplayEditCell";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";

afterEach(() => cleanup());

describe("ScriptBasicDisplayEditCell", () => {
  it("commits on blur after edit", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <ScriptBasicDisplayEditCell
        variant="input"
        value="3s"
        onCommit={onCommit}
      />,
    );
    await user.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "5s");
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith("5s");
  });
});

describe("ScriptBeatsScalarFieldCell basic display-edit", () => {
  it("shows description highlight before edit", () => {
    const beat = {
      ...emptyScriptBeat(),
      id: "b1",
      description: "陈南在崖边",
      characters: [{ id: "r1", name: "陈南", description: "", imagePath: "", reference: "", action: "", emotion: "", lines: "" }],
    };
    render(
      <ScriptBeatsScalarFieldCell
        beat={beat}
        rowIndex={0}
        normRows={[beat]}
        colKey="description"
        variant="inline"
        descRows={3}
        onPersistRows={vi.fn()}
        basicTable
      />,
    );
    expect(screen.getByText("陈南")).toBeInTheDocument();
  });
});
