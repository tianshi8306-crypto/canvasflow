import { describe, expect, it } from "vitest";
import { splitDescriptionWithRoleHighlights } from "@/lib/scriptDescriptionHighlight";

describe("scriptDescriptionHighlight", () => {
  it("highlights known role names", () => {
    const segs = splitDescriptionWithRoleHighlights("陈南与师父在崖边", ["陈南", "师父"]);
    expect(segs.some((s) => s.kind === "role" && s.text === "陈南")).toBe(true);
    expect(segs.some((s) => s.kind === "role" && s.text === "师父")).toBe(true);
  });
});
