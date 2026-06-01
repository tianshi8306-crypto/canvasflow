import { describe, expect, it } from "vitest";
import {
  collectBeatRoleReferencePaths,
  mergeReferencePaths,
  syncBibleCharactersFromScriptBeats,
} from "@/lib/projectBible/bibleRoleBindings";
import { emptyProjectBible } from "@/lib/projectBible/projectBible";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";
import type { ScriptBeat } from "@/lib/types";

function beat(partial: Partial<ScriptBeat> & { id: string }): ScriptBeat {
  return { ...emptyScriptBeat(), ...partial };
}

describe("bibleRoleBindings", () => {
  it("collectBeatRoleReferencePaths 合并镜头图与圣经默认图", () => {
    const b = beat({
      id: "b1",
      characters: [
        {
          id: "r1",
          name: "小明",
          description: "",
          imagePath: "",
          reference: "",
          action: "",
          emotion: "",
          lines: "",
        },
      ],
    });
    const bible = emptyProjectBible();
    bible.characters = [
      {
        id: "c1",
        name: "小明",
        description: "",
        referencePath: "assets/xiaoming.png",
        aliases: [],
      },
    ];
    expect(collectBeatRoleReferencePaths(b, bible)).toEqual(["assets/xiaoming.png"]);
  });

  it("镜头角色图优先于圣经", () => {
    const b = beat({
      id: "b1",
      characters: [
        {
          id: "r1",
          name: "小明",
          description: "",
          imagePath: "assets/beat-ref.png",
          reference: "",
          action: "",
          emotion: "",
          lines: "",
        },
      ],
    });
    const bible = emptyProjectBible();
    bible.characters = [
      {
        id: "c1",
        name: "小明",
        description: "",
        referencePath: "assets/bible.png",
        aliases: [],
      },
    ];
    const paths = collectBeatRoleReferencePaths(b, bible);
    expect(paths[0]).toBe("assets/beat-ref.png");
    expect(paths).toContain("assets/bible.png");
  });

  it("syncBibleCharactersFromScriptBeats 按名合并", () => {
    const beats = [
      beat({
        id: "b1",
        characters: [
          {
            id: "r1",
            name: "Alice",
            description: "红裙",
            imagePath: "assets/a.png",
            reference: "",
            action: "",
            emotion: "",
            lines: "",
          },
        ],
      }),
    ];
    const next = syncBibleCharactersFromScriptBeats(emptyProjectBible(), beats);
    expect(next.characters).toHaveLength(1);
    expect(next.characters[0]?.name).toBe("Alice");
    expect(next.characters[0]?.referencePath).toBe("assets/a.png");
  });

  it("mergeReferencePaths 去重并限 4 张", () => {
    expect(
      mergeReferencePaths(
        ["a.png", "b.png"],
        ["b.png", "c.png", "d.png", "e.png", "f.png"],
      ),
    ).toEqual(["a.png", "b.png", "c.png", "d.png"]);
  });
});
