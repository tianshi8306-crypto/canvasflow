import { describe, expect, it } from "vitest";
import {
  formatScriptVersionSnapshotNote,
  countScriptVersionsInStore,
} from "@/lib/hermes/agent/hermesScriptVersionAgent";
import type { HermesScriptVersionEntry } from "@/lib/hermes/agent/hermesScriptVersion";

describe("hermesScriptVersionAgent", () => {
  it("formats snapshot note with short id", () => {
    const entry: HermesScriptVersionEntry = {
      id: "sv-abc123xyz-extra",
      scriptNodeId: "n1",
      label: "script.generate_storyboard",
      createdAt: "2026-05-26T10:00:00.000Z",
      beatCount: 3,
      shotCount: 3,
      payload: {},
    };
    const note = formatScriptVersionSnapshotNote(entry);
    expect(note).toContain("sv-abc123xy");
    expect(note).toContain("版本对比");
  });

  it("counts versions per script node", () => {
    const store = {
      version: 1 as const,
      entries: [
        { id: "a", scriptNodeId: "n1", label: "x", createdAt: "", beatCount: 0, shotCount: 0, payload: {} },
        { id: "b", scriptNodeId: "n2", label: "x", createdAt: "", beatCount: 0, shotCount: 0, payload: {} },
        { id: "c", scriptNodeId: "n1", label: "x", createdAt: "", beatCount: 0, shotCount: 0, payload: {} },
      ],
    };
    expect(countScriptVersionsInStore(store, "n1")).toBe(2);
  });
});
