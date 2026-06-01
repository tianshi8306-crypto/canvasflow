import { describe, expect, it } from "vitest";
import {
  buildVersionStyleReferentFromEntry,
  formatVersionStyleReferentForPrompt,
  isVersionStyleReferentFresh,
  messageHasVersionReferent,
  resolveVersionSnapshotForShot,
} from "@/lib/hermes/agent/hermesVersionReferent";
import type { HermesScriptVersionEntry } from "@/lib/hermes/agent/hermesScriptVersion";
import { SCRIPT_BEAT_EMPTY_FIELDS } from "@/lib/scriptBeatHelpers";
import type { ScriptBeat } from "@/lib/types";

function makeBeat(id: string, shotNumber: string, extra: Partial<ScriptBeat> = {}): ScriptBeat {
  return { ...SCRIPT_BEAT_EMPTY_FIELDS, id, shotNumber, ...extra };
}

describe("hermesVersionReferent", () => {
  it("messageHasVersionReferent", () => {
    expect(messageHasVersionReferent("第2镜和上一版一样")).toBe(true);
    expect(messageHasVersionReferent("恢复上一版并出图")).toBe(true);
    expect(messageHasVersionReferent("按上面风格出图")).toBe(false);
  });

  it("buildVersionStyleReferentFromEntry collects visual and motion", () => {
    const older: HermesScriptVersionEntry = {
      id: "ver-old-abc",
      scriptNodeId: "s1",
      label: "v1",
      createdAt: "2026-01-01T00:00:00.000Z",
      beatCount: 2,
      shotCount: 2,
      payload: {
        scriptBeats: [
          makeBeat("b1", "1", { description: "a", videoMotionPrompt: "慢推" }),
          makeBeat("b2", "2", { description: "b", videoMotionPrompt: "横移" }),
        ],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "雨夜霓虹" },
          { scriptBeatId: "b2", status: "generated", visualPrompt: "室内暖光" },
        ],
      },
    };
    const ref = buildVersionStyleReferentFromEntry(older);
    expect(ref.olderVersionId).toBe("ver-old-abc");
    expect(ref.snapshots).toHaveLength(2);
    expect(ref.snapshots[0]?.visualPrompt).toContain("雨夜");
    expect(ref.snapshots[0]?.videoMotionPrompt).toBe("慢推");
  });

  it("resolveVersionSnapshotForShot respects freshness", () => {
    const ref = buildVersionStyleReferentFromEntry({
      id: "x",
      scriptNodeId: "s1",
      label: "v",
      createdAt: "2026-01-01",
      beatCount: 1,
      shotCount: 1,
      payload: {
        scriptBeats: [makeBeat("b1", "3", { description: "a" })],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "旧画面" },
        ],
      },
    });
    expect(resolveVersionSnapshotForShot(ref, 3)?.visualPrompt).toBe("旧画面");
    const stale = { ...ref, at: "2020-01-01T00:00:00.000Z" };
    expect(isVersionStyleReferentFresh(stale)).toBe(false);
    expect(resolveVersionSnapshotForShot(stale, 3)).toBeUndefined();
  });

  it("formatVersionStyleReferentForPrompt", () => {
    const ref = buildVersionStyleReferentFromEntry({
      id: "ver-1234567890",
      scriptNodeId: "s1",
      label: "v",
      createdAt: "2026-01-01",
      beatCount: 1,
      shotCount: 1,
      payload: {
        scriptBeats: [makeBeat("b1", "1", { description: "a" })],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "水墨远景" },
        ],
      },
    });
    const line = formatVersionStyleReferentForPrompt(ref);
    expect(line).toContain("上一版脚本快照");
    expect(line).toContain("ver-12345678");
    expect(line).toContain("水墨");
  });
});
