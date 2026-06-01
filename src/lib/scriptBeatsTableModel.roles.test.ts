import { describe, expect, it } from "vitest";
import { applyCharactersToBeat, getBeatRoles, patchRowCharacters } from "@/lib/scriptBeatsTableModel";
import type { ScriptBeat } from "@/lib/types";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";

describe("scriptBeatsTableModel roles sync", () => {
  it("applyCharactersToBeat syncs legacy character columns", () => {
    const beat = emptyScriptBeat();
    const next = applyCharactersToBeat(beat, [
      {
        id: "r1",
        name: "小明",
        description: "主角",
        imagePath: "assets/xiaoming.png",
        reference: "",
        action: "走",
        emotion: "喜",
        lines: "你好",
      },
    ]);
    expect(next.character1).toBe("小明");
    expect(next.character1Image).toBe("assets/xiaoming.png");
    expect(next.dialogue).toBe("你好");
  });

  it("getBeatRoles reads legacy when characters empty", () => {
    const beat: ScriptBeat = {
      ...emptyScriptBeat(),
      character1: "老王",
      character1Image: "assets/old.png",
      characters: [],
    };
    const roles = getBeatRoles(beat);
    expect(roles[0]?.name).toBe("老王");
    expect(roles[0]?.imagePath).toBe("assets/old.png");
  });

  it("patchRowCharacters updates table row legacy fields", () => {
    const rows = [emptyScriptBeat()];
    const next = patchRowCharacters(rows, 0, [
      {
        id: "r2",
        name: "乙",
        description: "",
        imagePath: "assets/b.png",
        reference: "",
        action: "",
        emotion: "",
        lines: "",
      },
    ]);
    expect(next[0]?.character1Image).toBe("assets/b.png");
  });
});
