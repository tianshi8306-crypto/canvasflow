import { describe, expect, it } from "vitest";
import {
  canStartScriptParse,
  resolveScriptParseRequirement,
  SCRIPT_PARSE_REQUIREMENT_WITH_UPSTREAM,
} from "./scriptParseDefaults";

describe("scriptParseDefaults", () => {
  it("resolveScriptParseRequirement keeps user prompt as-is", () => {
    expect(resolveScriptParseRequirement("竖屏短剧", true)).toBe("竖屏短剧");
    expect(resolveScriptParseRequirement("", true)).toBe("");
  });

  it("canStartScriptParse allows empty brief with upstream", () => {
    expect(canStartScriptParse("", true)).toBe(true);
    expect(canStartScriptParse("", false)).toBe(false);
    expect(canStartScriptParse("短剧", false)).toBe(true);
  });

  it("SCRIPT_PARSE_REQUIREMENT_WITH_UPSTREAM still used for import flows", () => {
    expect(SCRIPT_PARSE_REQUIREMENT_WITH_UPSTREAM).toBe("短剧");
  });
});
