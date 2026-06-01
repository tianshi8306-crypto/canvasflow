import { describe, expect, it } from "vitest";
import { findIncomingImageRefEdge } from "@/components/nodes/ImageRefThumbStrip";

describe("findIncomingImageRefEdge", () => {
  const edges = [
    { id: "e1", source: "img-a", target: "tgt", targetHandle: "in" },
    { id: "e2", source: "img-b", target: "tgt", targetHandle: "in" },
    { id: "e3", source: "img-c", target: "other" },
  ];

  it("returns edge id for matching upstream image node", () => {
    expect(findIncomingImageRefEdge(edges, "tgt", "img-a")).toBe("e1");
    expect(findIncomingImageRefEdge(edges, "tgt", "img-b")).toBe("e2");
  });

  it("returns null when no matching edge", () => {
    expect(findIncomingImageRefEdge(edges, "tgt", "missing")).toBeNull();
    expect(findIncomingImageRefEdge(edges, "other", "img-a")).toBeNull();
  });
});
