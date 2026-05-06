import { describe, expect, it } from "vitest";
import type { ScriptBeat, ScriptRole } from "@/lib/types";
import {
  normalizeRoleDescDisplayText,
  normalizeRoleDescTemplate,
  patchRow,
  patchRowCharacters,
  roleDescDisplayText,
  roleDescFromDisplayText,
  rowMatchesFilter,
  serializeCharacters,
  updateRoleField,
  getRoleCompat,
  parseCharacters,
} from "./scriptBeatsTableModel";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const makeBeat = (overrides: Partial<ScriptBeat> = {}): ScriptBeat => ({
  id: "beat-1",
  shotNumber: "",
  durationHint: "",
  description: "",
  character1: "",
  character1Desc: "",
  character1Image: "",
  character2: "",
  character2Desc: "",
  character2Image: "",
  reference: "",
  shotSize: "",
  characterAction: "",
  emotion: "",
  sceneTags: "",
  lightingMood: "",
  soundEffect: "",
  dialogue: "",
  storyboardPrompt: "",
  videoMotionPrompt: "",
  scene: "",
  characters: [],
  ...overrides,
});

const makeRole = (overrides: Partial<ScriptRole> = {}): ScriptRole => ({
  id: "role-1",
  name: "角色A",
  description: "描述内容",
  imagePath: "",
  reference: "",
  action: "",
  emotion: "",
  lines: "",
  ...overrides,
});

// ---------------------------------------------------------------------------
// patchRow
// ---------------------------------------------------------------------------

describe("patchRow", () => {
  it("updates the specified row at correct index", () => {
    const rows = [makeBeat({ id: "a" }), makeBeat({ id: "b" }), makeBeat({ id: "c" })];
    const result = patchRow(rows, 1, "description", "new desc");
    expect(result[1].description).toBe("new desc");
    expect(result[0].id).toBe("a");
    expect(result[2].id).toBe("c");
  });

  it("does not mutate the original array", () => {
    const rows = [makeBeat({ id: "a" }), makeBeat({ id: "b" })];
    patchRow(rows, 0, "description", "changed");
    expect(rows[0].description).toBe("");
  });

  it("returns a new array reference", () => {
    const rows = [makeBeat()];
    expect(patchRow(rows, 0, "description", "x")).not.toBe(rows);
  });

  it("handles out-of-range index by returning copy of rows", () => {
    const rows = [makeBeat({ id: "a" })];
    expect(patchRow(rows, 99, "description", "x")).toHaveLength(1);
    expect(patchRow(rows, -1, "description", "x")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// patchRowCharacters
// ---------------------------------------------------------------------------

describe("patchRowCharacters", () => {
  it("replaces characters array at the given index", () => {
    const rows = [makeBeat({ id: "a" }), makeBeat({ id: "b" })];
    const roles = [makeRole({ name: "Alice" }), makeRole({ name: "Bob" })];
    const result = patchRowCharacters(rows, 0, roles);
    expect(result[0].characters).toEqual(roles);
    expect(result[1].characters).toHaveLength(0);
  });

  it("does not mutate original rows", () => {
    const rows = [makeBeat({ id: "a", characters: [] })];
    patchRowCharacters(rows, 0, [makeRole({ name: "X" })]);
    expect(rows[0].characters).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// serializeCharacters / parseCharacters
// ---------------------------------------------------------------------------

describe("serializeCharacters", () => {
  it("serializes a single role to pipe-separated string", () => {
    const roles = [makeRole({ name: "Alice", description: "tall", imagePath: "", action: "walk", emotion: "happy", lines: "Hello" })];
    const s = serializeCharacters(roles);
    expect(s).toContain("Alice");
    expect(s).toContain("tall");
    expect(s).toContain("walk");
    expect(s).toContain("happy");
    expect(s).toContain("Hello");
  });

  it("serializes multiple roles to newline-separated strings", () => {
    const roles = [makeRole({ name: "A" }), makeRole({ name: "B" })];
    const s = serializeCharacters(roles);
    const lines = s.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it("handles undefined input", () => {
    expect(serializeCharacters(undefined)).toBe("");
  });

  it("handles empty array", () => {
    expect(serializeCharacters([])).toBe("");
  });

  it("serializes fields with spaces preserved (no internal trimming)", () => {
    const roles = [makeRole({ name: "  Alice  ", description: "  desc  ", imagePath: "", action: "", emotion: "", lines: "  hi  " })];
    const s = serializeCharacters(roles);
    // The function preserves spaces within fields (no internal trim), just splits on |
    expect(s).toContain("  Alice  ");
    expect(s).toContain("  desc  ");
    expect(s).toContain("  hi  ");
  });
});

describe("parseCharacters", () => {
  it("parses pipe-separated string to ScriptRole objects", () => {
    const text = "Alice | tall and thin | img.png | walk | happy | Hello world";
    const roles = parseCharacters(text);
    expect(roles).toHaveLength(1);
    expect(roles[0].name).toBe("Alice");
    expect(roles[0].description).toBe("tall and thin");
    expect(roles[0].imagePath).toBe("img.png");
    expect(roles[0].action).toBe("walk");
    expect(roles[0].emotion).toBe("happy");
    expect(roles[0].lines).toBe("Hello world");
  });

  it("parses multiple lines into multiple roles", () => {
    const text = "Alice | desc1 | | | | \nBob | desc2 | | | | ";
    const roles = parseCharacters(text);
    expect(roles).toHaveLength(2);
    expect(roles[0].name).toBe("Alice");
    expect(roles[1].name).toBe("Bob");
  });

  it("generates a random id for each role", () => {
    const roles = parseCharacters("Alice | desc | | | |");
    expect(roles[0].id).toBeTruthy();
    expect(roles[0].id.length).toBeGreaterThan(0);
  });

  it("filters out lines with empty name after trim", () => {
    const roles = parseCharacters("Alice | desc | | | |\n   \nBob | desc | | | |");
    expect(roles).toHaveLength(2); // blank line filtered
  });

  it("handles empty input", () => {
    expect(parseCharacters("")).toHaveLength(0);
    expect(parseCharacters("   \n  ")).toHaveLength(0);
  });

  it("round-trips through serialize then deserialize", () => {
    const original: ScriptRole[] = [
      makeRole({ name: "Charlie", description: "engineer", action: "coding", emotion: "focused", lines: "looks good" }),
    ];
    const s = serializeCharacters(original);
    const parsed = parseCharacters(s);
    expect(parsed[0].name).toBe("Charlie");
    expect(parsed[0].description).toBe("engineer");
    expect(parsed[0].action).toBe("coding");
  });
});

// ---------------------------------------------------------------------------
// normalizeRoleDescTemplate
// ---------------------------------------------------------------------------

describe("normalizeRoleDescTemplate", () => {
  it("fills empty input with template keys", () => {
    const result = normalizeRoleDescTemplate("");
    expect(result).toContain("基础身份：");
    expect(result).toContain("面部特征：");
    expect(result).toContain("服饰装备：");
    expect(result).toContain("姿态与互动：");
    expect(result).toContain("环境与风格：");
  });

  it("preserves filled keys", () => {
    const result = normalizeRoleDescTemplate("基础身份：医生\n面部特征：高大");
    expect(result).toContain("基础身份：医生");
    expect(result).toContain("面部特征：高大");
    expect(result).toContain("服饰装备：");
  });

  it("handles alternative separator ;", () => {
    const result = normalizeRoleDescTemplate("基础身份：护士；面部特征：矮小");
    expect(result).toContain("基础身份：护士");
    expect(result).toContain("面部特征：矮小");
  });

  it("trims whitespace", () => {
    const result = normalizeRoleDescTemplate("  基础身份：学生  ");
    expect(result).toContain("基础身份：学生");
  });
});

// ---------------------------------------------------------------------------
// roleDescDisplayText / roleDescFromDisplayText / normalizeRoleDescDisplayText
// ---------------------------------------------------------------------------

describe("roleDescDisplayText", () => {
  it("extracts values from template format", () => {
    const template = "基础身份：医生\n面部特征：高大\n服饰装备：\n姿态与互动：\n环境与风格：";
    const display = roleDescDisplayText(template);
    expect(display.split("\n")).toEqual(["医生", "高大", "", "", ""]);
  });

  it("extracts values from template format", () => {
    const template = "基础身份：医生\n面部特征：高大\n服饰装备：\n姿态与互动：\n环境与风格：";
    const display = roleDescDisplayText(template);
    expect(display.split("\n")).toEqual(["医生", "高大", "", "", ""]);
  });

  it("handles non-template input by normalizing to template then extracting values", () => {
    // normalizeRoleDescTemplate fills in template keys for any input
    const display = roleDescDisplayText("random text");
    // After normalizeRoleDescTemplate + extract, all values are empty -> just newlines
    expect(display).toBe("\n\n\n\n");
  });

  it("round-trips through roleDescFromDisplayText", () => {
    const original = "基础身份：医生\n面部特征：高大\n服饰装备：白大褂\n姿态与互动：站立\n环境与风格：医院";
    const display = roleDescDisplayText(original);
    const back = roleDescFromDisplayText(display);
    expect(back).toBe(original);
  });

  it("normalizeRoleDescDisplayText round-trips display text through template format", () => {
    // Display text format = just newline-separated values
    const displayText = "医生\n高大\n白大褂\n站立\n医院";
    const result = normalizeRoleDescDisplayText(displayText);
    // Round-trips back to display text format (not template format)
    expect(result.split("\n")).toEqual(["医生", "高大", "白大褂", "站立", "医院"]);
    expect(result).not.toContain("基础身份：");
  });
});

// ---------------------------------------------------------------------------
// rowMatchesFilter
// ---------------------------------------------------------------------------

describe("rowMatchesFilter", () => {
  it("returns true for empty query", () => {
    expect(rowMatchesFilter(makeBeat({ description: "some text" }), "")).toBe(true);
    expect(rowMatchesFilter(makeBeat({ description: "some text" }), "   ")).toBe(true);
  });

  it("matches description case-insensitively", () => {
    expect(rowMatchesFilter(makeBeat({ description: "A cat on a table" }), "cat")).toBe(true);
    expect(rowMatchesFilter(makeBeat({ description: "A cat on a table" }), "CAT")).toBe(true);
    expect(rowMatchesFilter(makeBeat({ description: "A cat on a table" }), "dog")).toBe(false);
  });

  it("matches character1 and character1Desc", () => {
    expect(rowMatchesFilter(makeBeat({ character1: "Alice" }), "alice")).toBe(true);
    expect(rowMatchesFilter(makeBeat({ character1Desc: "A brave hero" }), "hero")).toBe(true);
    expect(rowMatchesFilter(makeBeat({ character1: "Bob", character1Desc: "" }), "alice")).toBe(false);
  });

  it("matches character2 and character2Desc", () => {
    expect(rowMatchesFilter(makeBeat({ character2: "Carol" }), "carol")).toBe(true);
    expect(rowMatchesFilter(makeBeat({ character2Desc: "Antagonist" }), "antagonist")).toBe(true);
  });

  it("matches in characters array", () => {
    const beat = makeBeat({
      characters: [
        makeRole({ name: "Dave", description: "friendly", action: "wave", emotion: "happy", lines: "Hello" }),
      ],
    });
    expect(rowMatchesFilter(beat, "dave")).toBe(true);
    expect(rowMatchesFilter(beat, "friendly")).toBe(true);
    expect(rowMatchesFilter(beat, "wave")).toBe(true);
    expect(rowMatchesFilter(beat, "hello")).toBe(true);
    expect(rowMatchesFilter(beat, "nonexistent")).toBe(false);
  });

  it("matches shotSize, emotion, sceneTags", () => {
    expect(rowMatchesFilter(makeBeat({ shotSize: "wide" }), "wide")).toBe(true);
    expect(rowMatchesFilter(makeBeat({ emotion: "sad" }), "sad")).toBe(true);
    expect(rowMatchesFilter(makeBeat({ sceneTags: "outdoor" }), "outdoor")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateRoleField
// ---------------------------------------------------------------------------

describe("updateRoleField", () => {
  it("creates new role at index when not present", () => {
    const rows = [makeBeat({ id: "beat-1" })];
    const result = updateRoleField(rows, 0, 1, { name: "Bob" });
    expect(result[0].characters?.[1]?.name).toBe("Bob");
  });

  it("updates existing role at index", () => {
    const rows = [makeBeat({ characters: [makeRole({ name: "Alice" }), makeRole({ name: "Bob" })] })];
    const result = updateRoleField(rows, 0, 0, { name: "Alicia" });
    expect(result[0].characters?.[0]?.name).toBe("Alicia");
    expect(result[0].characters?.[1]?.name).toBe("Bob");
  });

  it("syncs character1/name/desc/image when roleIdx=0", () => {
    const rows = [makeBeat({ id: "beat-1" })];
    const result = updateRoleField(rows, 0, 0, { name: "Alice", description: "smart", imagePath: "a.png" });
    expect(result[0].character1).toBe("Alice");
    expect(result[0].character1Desc).toBe("smart");
    expect(result[0].character1Image).toBe("a.png");
  });

  it("syncs character2/name/desc/image when roleIdx=1", () => {
    const rows = [makeBeat({ id: "beat-1" })];
    const result = updateRoleField(rows, 0, 1, { name: "Bob", description: "tall", imagePath: "b.png" });
    expect(result[0].character2).toBe("Bob");
    expect(result[0].character2Desc).toBe("tall");
    expect(result[0].character2Image).toBe("b.png");
  });

  it("does not touch other row indices", () => {
    const row0 = makeBeat({ id: "a" });
    const row1 = makeBeat({ id: "b", characters: [makeRole({ name: "Carol" })] });
    const result = updateRoleField([row0, row1], 0, 0, { name: "Alice" });
    expect(result[1].characters?.[0]?.name).toBe("Carol"); // unaffected
  });

  it("returns original rows unchanged when index out of range", () => {
    const rows = [makeBeat()];
    expect(updateRoleField(rows, 99, 0, { name: "X" })).toBe(rows);
  });
});

// ---------------------------------------------------------------------------
// getRoleCompat
// ---------------------------------------------------------------------------

describe("getRoleCompat", () => {
  it("returns characters[roleIdx] when present", () => {
    const beat = makeBeat({ characters: [makeRole({ name: "Alice", description: "desc1" }), makeRole({ name: "Bob", description: "desc2" })] });
    const role = getRoleCompat(beat, 0);
    expect(role.name).toBe("Alice");
    const role2 = getRoleCompat(beat, 1);
    expect(role2.name).toBe("Bob");
  });

  it("falls back to character1 fields when roleIdx=0 and no characters", () => {
    const beat = makeBeat({ character1: "Alice", character1Desc: "tall", character1Image: "a.png" });
    const role = getRoleCompat(beat, 0);
    expect(role.name).toBe("Alice");
    expect(role.description).toBe("tall");
    expect(role.imagePath).toBe("a.png");
  });

  it("falls back to character2 fields when roleIdx=1 and no characters", () => {
    const beat = makeBeat({ character2: "Bob", character2Desc: "short", character2Image: "b.png" });
    const role = getRoleCompat(beat, 1);
    expect(role.name).toBe("Bob");
    expect(role.description).toBe("short");
    expect(role.imagePath).toBe("b.png");
  });

  it("returns empty role for roleIdx >= 2 with no characters", () => {
    const beat = makeBeat({ character1: "Alice" });
    const role = getRoleCompat(beat, 2);
    expect(role.name).toBe("");
  });

  it("each call generates a new id", () => {
    const beat = makeBeat();
    const r1 = getRoleCompat(beat, 0);
    const r2 = getRoleCompat(beat, 0);
    expect(r1.id).not.toBe(r2.id);
  });
});

// ---------------------------------------------------------------------------
// round-trip: patchRowCharacters + getRoleCompat
// ---------------------------------------------------------------------------

describe("round-trip: patchRowCharacters + getRoleCompat", () => {
  it("serialize → patchRowCharacters → getRoleCompat returns same data", () => {
    const original: ScriptRole[] = [makeRole({ name: "Eve", description: "spy", imagePath: "eve.png" })];
    const beat = makeBeat({ id: "b1" });
    const patched = patchRowCharacters([beat], 0, original);
    const role = getRoleCompat(patched[0], 0);
    expect(role.name).toBe("Eve");
    expect(role.description).toBe("spy");
    expect(role.imagePath).toBe("eve.png");
  });
});