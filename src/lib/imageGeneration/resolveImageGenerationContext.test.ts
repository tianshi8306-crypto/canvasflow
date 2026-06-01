import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { collectIncomingImageRefs } from "@/lib/imageGeneration/collectIncomingImageRefs";
import { aggregateImagePrompt } from "@/lib/imageGeneration/aggregateImagePrompt";
import { detectImageTask, imageTaskStatusLabel } from "@/lib/imageGeneration/detectImageTask";
import { resolveImageGenerationContext } from "@/lib/imageGeneration/resolveImageGenerationContext";

const PROJECT = "/tmp/test-project";

function node(
  id: string,
  type: Node<FlowNodeData>["type"],
  data: Partial<FlowNodeData> = {},
  y = 0,
): Node<FlowNodeData> {
  return {
    id,
    type,
    position: { x: 0, y },
    data: data as FlowNodeData,
  } as Node<FlowNodeData>;
}

function edge(source: string, target: string, disabled = false): Edge {
  return {
    id: `${source}-${target}-${disabled ? "d" : "e"}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
    ...(disabled ? { data: { disabled: true } } : {}),
  };
}

describe("collectIncomingImageRefs", () => {
  it("collects imageNode and imageAsset sorted by Y", () => {
    const target = node("T", "imageNode");
    const imgLow = node("I1", "imageNode", { path: "a.png" }, 20);
    const assetHigh = node("A1", "imageAsset", { path: "b.png" }, 5);
    const nodes = [target, imgLow, assetHigh];
    const edges = [edge("I1", "T"), edge("A1", "T")];
    const { refs } = collectIncomingImageRefs(nodes, edges, "T");
    expect(refs.map((r) => r.sourceNodeId)).toEqual(["A1", "I1"]);
  });

  it("ignores disabled edges and empty paths", () => {
    const target = node("T", "imageNode");
    const empty = node("E", "imageNode", {}, 0);
    const ok = node("O", "imageNode", { path: "ok.png" }, 10);
    const nodes = [target, empty, ok];
    const edges = [edge("E", "T"), edge("O", "T", true)];
    const { refs } = collectIncomingImageRefs(nodes, edges, "T");
    expect(refs).toHaveLength(0);
  });

  it("truncates to 4 and sets truncated flag", () => {
    const target = node("T", "imageNode");
    const nodes: Node<FlowNodeData>[] = [target];
    const edges: Edge[] = [];
    for (let i = 0; i < 6; i++) {
      const id = `I${i}`;
      nodes.push(node(id, "imageNode", { path: `${i}.png` }, i * 10));
      edges.push(edge(id, "T"));
    }
    const { refs, truncated } = collectIncomingImageRefs(nodes, edges, "T");
    expect(refs).toHaveLength(4);
    expect(truncated).toBe(true);
  });
});

describe("aggregateImagePrompt", () => {
  it("merges script beat, upstream text, and local prompt", () => {
    const beatId = "beat-1";
    const script = node("S", "scriptNode", {
      scriptBeats: [{ id: beatId, description: "beat desc" } as ScriptBeat],
      storyboardShots: [{ scriptBeatId: beatId, visualPrompt: "shot visual" } as StoryboardShot],
    });
    const text = node("TXT", "textNode", { prompt: "text upstream" }, 5);
    const target = node("T", "imageNode", { prompt: "local", params: { scriptBeatId: beatId } }, 30);
    const nodes = [script, text, target];
    const edges = [edge("S", "T"), edge("TXT", "T")];

    const { prompt } = aggregateImagePrompt(nodes, edges, "T");
    expect(prompt).toContain("shot visual");
    expect(prompt).toContain("text upstream");
    expect(prompt).toContain("local");
    expect(prompt.endsWith("local")).toBe(true);
  });
});

describe("detectImageTask", () => {
  it("maps ref counts to tasks", () => {
    expect(detectImageTask([]).task).toBe("text_to_image");
    expect(detectImageTask(["a.png"]).task).toBe("image_to_image");
    expect(detectImageTask(["a.png", "b.png"]).task).toBe("multi_ref_fusion");
    expect(detectImageTask(["a.png", "b.png", "c.png", "d.png", "e.png"]).referenceImagePaths).toHaveLength(4);
  });

  it("formats status labels", () => {
    expect(imageTaskStatusLabel("text_to_image", 0)).toBe("文生图");
    expect(imageTaskStatusLabel("image_to_image", 1)).toContain("1 张参考");
  });
});

describe("resolveImageGenerationContext", () => {
  it("text_to_image when no refs and has prompt", async () => {
    const target = node("T", "imageNode", { prompt: "hello" });
    const ctx = await resolveImageGenerationContext([target], [], "T", PROJECT);
    expect(ctx.blockReason).toBeNull();
    expect(ctx.task).toBe("text_to_image");
    expect(ctx.referenceImagePaths).toEqual([]);
  });

  it("no task when no prompt (no inline block banner)", async () => {
    const target = node("T", "imageNode", { prompt: "" });
    const ctx = await resolveImageGenerationContext([target], [], "T", PROJECT);
    expect(ctx.blockReason).toBeNull();
    expect(ctx.task).toBeNull();
    expect(ctx.aggregatedPrompt).toBe("");
  });

  it("resolves upstream refs for panel strip even without prompt", async () => {
    const target = node("T", "imageNode", { prompt: "" });
    const r1 = node("R1", "imageNode", { path: "a.png" }, 0);
    const r2 = node("R2", "imageNode", { path: "b.png" }, 10);
    const ctx = await resolveImageGenerationContext(
      [target, r1, r2],
      [edge("R1", "T"), edge("R2", "T")],
      "T",
      PROJECT,
    );
    expect(ctx.blockReason).toBeNull();
    expect(ctx.aggregatedPrompt).toBe("");
    expect(ctx.task).toBe("multi_ref_fusion");
    expect(ctx.resolvedRefs).toHaveLength(2);
    expect(ctx.resolvedRefs.map((r) => r.resolvedPath)).toEqual(["a.png", "b.png"]);
    expect(ctx.referenceImagePaths).toEqual(["a.png", "b.png"]);
  });

  it("image_to_image with one upstream ref", async () => {
    const target = node("T", "imageNode", { prompt: "gen" });
    const ref = node("R", "imageNode", { path: "assets/ref.png" }, 0);
    const ctx = await resolveImageGenerationContext(
      [target, ref],
      [edge("R", "T")],
      "T",
      PROJECT,
    );
    expect(ctx.blockReason).toBeNull();
    expect(ctx.task).toBe("image_to_image");
    expect(ctx.referenceImagePaths).toEqual(["assets/ref.png"]);
  });

  it("allows multi_ref when API ready", async () => {
    const target = node("T", "imageNode", { prompt: "gen" });
    const r1 = node("R1", "imageNode", { path: "a.png" }, 0);
    const r2 = node("R2", "imageNode", { path: "b.png" }, 10);
    const ctx = await resolveImageGenerationContext(
      [target, r1, r2],
      [edge("R1", "T"), edge("R2", "T")],
      "T",
      PROJECT,
    );
    expect(ctx.task).toBe("multi_ref_fusion");
    expect(ctx.blockReason).toBeNull();
    expect(ctx.referenceImagePaths).toEqual(["a.png", "b.png"]);
  });

  it("blocks multiple script upstreams", async () => {
    const target = node("T", "imageNode", { prompt: "x" });
    const s1 = node("S1", "scriptNode", {}, 0);
    const s2 = node("S2", "scriptNode", {}, 10);
    const ctx = await resolveImageGenerationContext(
      [target, s1, s2],
      [edge("S1", "T"), edge("S2", "T")],
      "T",
      PROJECT,
    );
    expect(ctx.blockReason).toContain("多个脚本");
  });

  it("warns when more than 4 refs collected", async () => {
    const target = node("T", "imageNode", { prompt: "x" });
    const nodes: Node<FlowNodeData>[] = [target];
    const edges: Edge[] = [];
    for (let i = 0; i < 5; i++) {
      const id = `R${i}`;
      nodes.push(node(id, "imageNode", { path: `${i}.png` }, i));
      edges.push(edge(id, "T"));
    }
    const ctx = await resolveImageGenerationContext(nodes, edges, "T", PROJECT);
    expect(ctx.warnMessage).toContain("4 张");
    expect(ctx.task).toBe("multi_ref_fusion");
    expect(ctx.blockReason).toBeNull();
  });

  it("image_edit when edit intent active and local path with no upstream", async () => {
    const target = node("T", "imageNode", {
      prompt: "refine",
      path: "assets/self.png",
      params: { imageEditIntent: { active: true, subAction: "redraw" } },
    });
    const ctx = await resolveImageGenerationContext([target], [], "T", PROJECT);
    expect(ctx.blockReason).toBeNull();
    expect(ctx.task).toBe("image_edit");
    expect(ctx.referenceImagePaths).toEqual(["assets/self.png"]);
    expect(ctx.aggregatedPrompt).toContain("重绘");
  });

  it("blocks image_edit when no local image", async () => {
    const target = node("T", "imageNode", {
      prompt: "x",
      params: { imageEditIntent: { active: true, subAction: "hd" } },
    });
    const ctx = await resolveImageGenerationContext([target], [], "T", PROJECT);
    expect(ctx.blockReason).toContain("上传");
    expect(ctx.task).toBeNull();
  });

  it("ignores image_edit when upstream refs exist", async () => {
    const target = node("T", "imageNode", {
      prompt: "gen",
      path: "assets/self.png",
      params: { imageEditIntent: { active: true, subAction: "redraw" } },
    });
    const ref = node("R", "imageNode", { path: "assets/ref.png" }, 0);
    const ctx = await resolveImageGenerationContext(
      [target, ref],
      [edge("R", "T")],
      "T",
      PROJECT,
    );
    expect(ctx.task).toBe("image_to_image");
    expect(ctx.warnMessage).toContain("编辑模式未生效");
  });

  it("script binding contributes prompt without local text", async () => {
    const beatId = "b1";
    const script = node("S", "scriptNode", {
      scriptBeats: [{ id: beatId, description: "desc" } as ScriptBeat],
      storyboardShots: [{ scriptBeatId: beatId, visualPrompt: "visual only" } as StoryboardShot],
    });
    const target = node("T", "imageNode", { params: { scriptBeatId: beatId } });
    const ctx = await resolveImageGenerationContext(
      [script, target],
      [edge("S", "T")],
      "T",
      PROJECT,
    );
    expect(ctx.aggregatedPrompt).toContain("visual only");
    expect(ctx.blockReason).toBeNull();
    expect(ctx.task).toBe("text_to_image");
  });
});
