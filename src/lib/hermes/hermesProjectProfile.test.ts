import { describe, expect, it } from "vitest";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import {
  inferHermesProductionProjectType,
  projectTypeBoostForSkill,
} from "@/lib/hermes/hermesProjectProfile";

describe("hermesProjectProfile", () => {
  it("无脚本为 freeform", () => {
    const s = buildHermesSituation([], [], "/proj");
    expect(inferHermesProductionProjectType(s)).toBe("freeform");
  });

  it("多镜为 short_drama", () => {
    const beats = Array.from({ length: 8 }, (_, i) => ({
      id: `b${i}`,
      shotNumber: String(i + 1),
      description: "x",
    }));
    const nodes = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: beats,
          storyboardShots: beats.map((b) => ({
            scriptBeatId: b.id,
            status: "generated",
            visualPrompt: "v",
          })),
        },
      },
    ];
    const s = buildHermesSituation(nodes as never, [], "/proj");
    expect(inferHermesProductionProjectType(s)).toBe("short_drama");
    expect(projectTypeBoostForSkill("short_drama", "short-drama")).toBe(8);
    expect(projectTypeBoostForSkill("short_drama", "tts-delivery")).toBe(0);
  });
});
