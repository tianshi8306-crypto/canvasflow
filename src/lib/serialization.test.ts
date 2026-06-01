import { describe, expect, it } from "vitest";
import type { Edge, Node, Viewport } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { parseCanvas, serializeCanvas, CURRENT_CANVAS_VERSION, defaultViewport } from "./serialization";

describe("serializeCanvas", () => {
  it("includes version field in output", () => {
    const raw = serializeCanvas([], [], defaultViewport);
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(CURRENT_CANVAS_VERSION);
  });

  it("includes viewport, nodes, edges keys", () => {
    const vp: Viewport = { x: 10, y: 20, zoom: 0.5 };
    const nodes: Node<FlowNodeData>[] = [];
    const edges: Edge[] = [];
    const raw = serializeCanvas(nodes, edges, vp);
    const parsed = JSON.parse(raw);
    expect(parsed.viewport).toEqual(vp);
    expect(parsed.nodes).toEqual([]);
    expect(parsed.edges).toEqual([]);
  });

  it("includes meta counters when provided", () => {
    const raw = serializeCanvas([], [], defaultViewport, {
      imageNodeCounter: 3,
      videoNodeCounter: 2,
      textNodeCounter: 4,
      audioNodeCounter: 1,
      scriptNodeCounter: 2,
    });
    const parsed = JSON.parse(raw);
    expect(parsed.meta).toEqual({
      imageNodeCounter: 3,
      videoNodeCounter: 2,
      textNodeCounter: 4,
      audioNodeCounter: 1,
      scriptNodeCounter: 2,
    });
  });

  it("preserves node and edge data", () => {
    const nodes: Node<FlowNodeData>[] = [
      { id: "n1", type: "scriptNode", position: { x: 100, y: 200 }, data: { label: "Test" } } as Node<FlowNodeData>,
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "out", targetHandle: "in" } as Edge,
    ];
    const vp: Viewport = { x: 0, y: 0, zoom: 1 };
    const raw = serializeCanvas(nodes, edges, vp);
    const parsed = JSON.parse(raw);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]!.id).toBe("n1");
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0]!.id).toBe("e1");
  });
});

describe("parseCanvas", () => {
  it("parses meta counters from v2 canvas", () => {
    const raw = JSON.stringify({
      version: 2,
      viewport: defaultViewport,
      nodes: [],
      edges: [],
      meta: {
        imageNodeCounter: 5,
        videoNodeCounter: 7,
        textNodeCounter: 3,
        audioNodeCounter: 2,
        scriptNodeCounter: 1,
      },
    });
    const { meta } = parseCanvas(raw);
    expect(meta).toEqual({
      imageNodeCounter: 5,
      videoNodeCounter: 7,
      textNodeCounter: 3,
      audioNodeCounter: 2,
      scriptNodeCounter: 1,
    });
  });

  it("returns empty state for empty JSON object", () => {
    const { nodes, edges, viewport, invalidEdgesDropped } = parseCanvas("{}");
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
    expect(viewport).toEqual(defaultViewport);
    expect(invalidEdgesDropped).toBe(0);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseCanvas("not json at all")).toThrow("工程文件格式损坏，无法解析 JSON");
    expect(() => parseCanvas('{ "nodes":')).toThrow("工程文件格式损坏，无法解析 JSON");
  });

  it("returns default viewport when viewport is missing or invalid", () => {
    const { viewport } = parseCanvas('{"nodes": []}');
    expect(viewport).toEqual(defaultViewport);
  });

  it("drops nodes missing id field", () => {
    const raw = JSON.stringify({
      nodes: [
        { id: "valid-node", type: "imageNode", position: { x: 0, y: 0 }, data: {} },
        { type: "imageNode", position: { x: 0, y: 0 }, data: {} }, // missing id
        { id: 123, position: { x: 0, y: 0 }, data: {} }, // id not string
      ],
    });
    const { nodes } = parseCanvas(raw);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.id).toBe("valid-node");
  });

  it("drops edges that fail sanitizeCanvasEdges (dangling refs) and validateEdge (missing id/source/target)", () => {
    const raw = JSON.stringify({
      nodes: [
        { id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: {} },
        { id: "n2", type: "videoNode", position: { x: 100, y: 0 }, data: {} },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" }, // valid: passes sanitize and validate
        { source: "n1", target: "n2" }, // missing id → sanitize keeps (source/target valid), validate drops (no id)
        { id: "e3", target: "n2" }, // missing source → sanitize drops (dangling), validate drops
        { id: "e4", source: "n1" }, // missing target → sanitize drops (dangling), validate drops
      ],
    });
    const { edges, invalidEdgesDropped } = parseCanvas(raw);
    // sanitizeCanvasEdges: keeps [e1]; drops duplicate n1→n2 (idless), dangling e3/e4
    // validateEdge on rawEdges: only e1 passes
    expect(edges).toHaveLength(1);
    expect(edges[0]!.id).toBe("e1");
    expect(invalidEdgesDropped).toBe(6);
  });

  it("drops nodes with non-object type fields but keeps valid ones", () => {
    const raw = JSON.stringify({
      nodes: [
        { id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: {} },
        { id: "n2", position: { x: 0, y: 0 }, data: {} }, // no type — still kept (type is optional)
      ],
    });
    const { nodes } = parseCanvas(raw);
    expect(nodes).toHaveLength(2);
  });

  it("returns invalidEdgesDropped count for bad edges", () => {
    const raw = JSON.stringify({
      nodes: [
        { id: "n1", type: "imageNode", position: { x: 0, y: 0 }, data: {} },
        { id: "n2", type: "videoNode", position: { x: 100, y: 0 }, data: {} },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n1" }, // no target
        { id: "e3", target: "n2" }, // no source
      ],
    });
    const { invalidEdgesDropped } = parseCanvas(raw);
    expect(invalidEdgesDropped).toBeGreaterThanOrEqual(2);
  });
});

describe("parseCanvas — version migration", () => {
  it("parses v1 files with version field without migration", () => {
    const v1File = JSON.stringify({
      version: 1,
      viewport: { x: 5, y: 10, zoom: 2 },
      nodes: [
        { id: "n1", type: "scriptNode", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [],
    });
    const { nodes, viewport } = parseCanvas(v1File);
    expect(nodes).toHaveLength(1);
    expect(viewport.x).toBe(5);
  });

  it("treats missing version as v0 and migrates scene from shotSize", () => {
    // v0 file: no version field, scriptBeat has shotSize but empty scene
    const v0File = JSON.stringify({
      nodes: [
        {
          id: "s1",
          type: "scriptNode",
          position: { x: 0, y: 0 },
          data: {
            scriptBeats: [
              { id: "b1", shotSize: "close-up", scene: "" }, // scene empty, shotSize exists
            ],
          },
        },
      ],
      edges: [],
    });
    const { nodes } = parseCanvas(v0File);
    const beat = (nodes[0]!.data as { scriptBeats?: Array<{ scene?: string; shotSize?: string }> }).scriptBeats?.[0];
    // Migration: shotSize value is copied into scene field
    expect(beat!.scene).toBe("close-up");
    // shotSize is preserved in the migrated object (not deleted)
    expect(beat!.shotSize).toBe("close-up");
  });

  it("does not migrate if scene already has value", () => {
    const v0File = JSON.stringify({
      nodes: [
        {
          id: "s1",
          type: "scriptNode",
          position: { x: 0, y: 0 },
          data: {
            scriptBeats: [
              { id: "b1", shotSize: "close-up", scene: "wide" }, // scene already set → keep
            ],
          },
        },
      ],
      edges: [],
    });
    const { nodes } = parseCanvas(v0File);
    const beat = (nodes[0]!.data as { scriptBeats?: Array<{ scene?: string }> }).scriptBeats?.[0];
    expect(beat!.scene).toBe("wide"); // scene preserved
  });

  it("handles future version numbers gracefully", () => {
    const futureFile = JSON.stringify({
      version: 99,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: [],
    });
    // Should not throw, just warn and load what it can
    const { nodes, viewport } = parseCanvas(futureFile);
    expect(nodes).toEqual([]);
    expect(viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("handles completely empty nodes/edges arrays", () => {
    const raw = JSON.stringify({ version: 1, nodes: null, edges: null, viewport: null });
    const { nodes, edges, viewport } = parseCanvas(raw);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
    expect(viewport).toEqual(defaultViewport);
  });
});

describe("parseCanvas — roundtrip", () => {
  it("serialized then parsed preserves script node data", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "剧本",
          scriptBeats: [
            {
              id: "beat-1",
              shotNumber: "01",
              scene: "室内",
              durationHint: "5s",
              description: "测试",
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
            },
          ],
          scriptBeatSelection: ["beat-1"],
        },
      } as Node<FlowNodeData>,
    ];
    const edges: Edge[] = [];
    const vp: Viewport = { x: 0, y: 0, zoom: 1 };

    const raw = serializeCanvas(nodes, edges, vp);
    const { nodes: parsedNodes } = parseCanvas(raw);

    expect(parsedNodes).toHaveLength(1);
    expect((parsedNodes[0]!.data as { scriptBeats?: unknown[] }).scriptBeats).toHaveLength(1);
    expect((parsedNodes[0]!.data as { scriptBeatSelection?: string[] }).scriptBeatSelection).toEqual(["beat-1"]);
  });
});