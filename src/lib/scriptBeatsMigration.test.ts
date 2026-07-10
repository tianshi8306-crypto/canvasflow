import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { emptyScriptBeat } from "@/lib/scriptBeatHelpers";
import { migrateScriptBeatForLoad, migrateScriptNodesOnLoad } from "@/lib/scriptBeatsMigration";
import type { FlowNodeData } from "@/lib/types";

describe("scriptBeatsMigration", () => {
  it("backfills lighting from storyboardBlock and reconciles english prompt", () => {
    const beat = migrateScriptBeatForLoad({
      ...emptyScriptBeat(),
      id: "b1",
      description: "崖边",
      storyboardBlock: "景别：全景\n光影：霓虹逆光\n画面：崖边",
      storyboardPrompt: "cinematic neon backlight",
    });
    expect(beat.lightingMood).toBe("霓虹逆光");
    expect(beat.seedancePositive).toBe("cinematic neon backlight");
    expect(beat.storyboardPrompt).toContain("崖边");
    expect(beat.storyboardPrompt).not.toContain("cinematic");
  });

  it("migrates script nodes on project load", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [
            {
              ...emptyScriptBeat(),
              id: "b1",
              description: "测试",
              storyboardPrompt: "english only prompt text here",
            },
          ],
        },
      },
    ];
    const { nodes: next, migratedCount } = migrateScriptNodesOnLoad(nodes);
    expect(migratedCount).toBe(1);
    expect(next[0]?.data.scriptBeats?.[0]?.storyboardPrompt).toContain("测试");
  });
});
