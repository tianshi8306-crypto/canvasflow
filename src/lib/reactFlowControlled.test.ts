import { describe, expect, it } from "vitest";
import {
  filterReactFlowEdgeEchoChanges,
  isReactFlowSelectionEchoSuppressed,
  runIgnoringReactFlowSelectionEcho,
} from "@/lib/reactFlowControlled";

describe("reactFlowControlled", () => {
  it("filters edge echo change types except remove", () => {
    const out = filterReactFlowEdgeEchoChanges([
      { type: "select", id: "e1", selected: true },
      { type: "replace", id: "e1", item: { id: "e1" } } as never,
      { type: "remove", id: "e1" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe("remove");
  });

  it("suppresses selection echo during programmatic updates", async () => {
    expect(isReactFlowSelectionEchoSuppressed()).toBe(false);
    runIgnoringReactFlowSelectionEcho(() => {
      expect(isReactFlowSelectionEchoSuppressed()).toBe(true);
    });
    expect(isReactFlowSelectionEchoSuppressed()).toBe(true);

    await new Promise<void>((resolve) => {
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            expect(isReactFlowSelectionEchoSuppressed()).toBe(false);
            resolve();
          });
        });
      });
    });
  });
});
