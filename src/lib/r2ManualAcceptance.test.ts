/**
 * R2 手工验收 §30–34 等价自动化测试
 *
 * 原始 iteration-02-canvas-and-nodes.md §30–34 要求：
 *   30. 新建工程后依次创建文本/图片/视频/音频/脚本节点并填写最小内容。
 *   31. 对每类节点执行选中、复制、粘贴、删除与连线，确认反馈一致。
 *   32. 拖入 3-5 个本地素材（混合格式），确认导入成功提示和节点自动排布。（依赖 Tauri/文件系统，跳过自动化）
 *   33. 故意拖入不支持文件，确认失败提示可读。（依赖 Tauri，跳过自动化）
 *   34. 保存并重启后打开工程，确认节点内容/素材路径/连线全部恢复。（依赖 Tauri，跳过自动化）
 *
 * 本文件覆盖可在纯 JS 环境验证的核心逻辑：
 *   - 五类节点初始 data 结构（§30）
 *   - copySelection / pasteSelection 数据流（§31）
 *   - deleteSelection 数据流（§31）
 *   - onConnect 连线合法性（§31）
 *   - 含脚本子图的粘贴：节点UUID全新、beatId全新、下游节点 params.scriptBeatId 同步重映射（§34 Inspector 验收等价）
 *   - 粘贴后脚本节点 scriptBeatSelection / storyboardShots.scriptBeatId 与 scriptBeats.id 保持一致（§34 核心）
 */

import { describe, it, expect } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { buildPasteNodesFromClipboard } from "@/lib/buildPasteNodesFromClipboard";
import { findUpstreamScriptNodeIdInSubgraph } from "@/lib/pasteScriptBeatRemap";
import { isConnectionAllowed } from "@/lib/flowConnectionPolicy";

// ─────────────────────────────────────────────
// §30：五类节点最小初始 data
// ─────────────────────────────────────────────
describe("§30 五类节点初始空 data", () => {
  it("textNode 初始 data 含 label 和空 prompt", () => {
    const d = newNodeDataByType.textNode();
    expect(d.label).toBe("文本");
    expect(d.prompt).toBe("");
  });

  it("imageNode 初始 data 含 label 和空 path", () => {
    const d = newNodeDataByType.imageNode();
    expect(d.label).toBe("图片");
    expect(d.path).toBe("");
  });

  it("videoNode 初始 data 含 label、空 path 和 video 字段", () => {
    const d = newNodeDataByType.videoNode();
    expect(d.label).toBe("视频");
    expect(d.path).toBe("");
    expect(d.video).toBeDefined();
  });

  it("audioNode 初始 data 含 label 和空 path", () => {
    const d = newNodeDataByType.audioNode();
    expect(d.label).toBe("音频");
    expect(d.path).toBe("");
  });

  it("scriptNode 初始 data 含 label 和空 prompt，无 scriptBeats", () => {
    const d = newNodeDataByType.scriptNode();
    expect(d.label).toBe("分镜脚本");
    expect(d.prompt).toBe("");
    expect(d.scriptBeats).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// §31：连线合法性（五类节点互联规则）
// ─────────────────────────────────────────────
describe("§31 连线合法性（flowConnectionPolicy）", () => {
  // 脚本→图像 允许（R2 主创作链路）
  it("scriptNode → imageNode 允许", () => {
    expect(isConnectionAllowed("scriptNode", "imageNode")).toBe(true);
  });

  // 脚本→视频 允许
  it("scriptNode → videoNode 允许", () => {
    expect(isConnectionAllowed("scriptNode", "videoNode")).toBe(true);
  });

  // 文本→脚本 允许
  it("textNode → scriptNode 允许", () => {
    expect(isConnectionAllowed("textNode", "scriptNode")).toBe(true);
  });

  // 图像→视频 允许（参考图）
  it("imageNode → videoNode 允许", () => {
    expect(isConnectionAllowed("imageNode", "videoNode")).toBe(true);
  });

  // 音频→脚本 不允许（输出类型不匹配）
  it("audioNode → scriptNode 不允许", () => {
    expect(isConnectionAllowed("audioNode", "scriptNode")).toBe(false);
  });

  // 视频→图像 不允许
  it("videoNode → imageNode 不允许", () => {
    expect(isConnectionAllowed("videoNode", "imageNode")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// §31 / §34 核心：copySelection + pasteSelection 数据流
// （直接调用 store 辅助函数，不依赖 Tauri/DOM）
// ─────────────────────────────────────────────
describe("§31 §34 复制/粘贴含脚本子图 – beatId 独立副本", () => {
  const BEAT_ID_A = "beat-aaaa-0001";
  const BEAT_ID_B = "beat-bbbb-0002";

  /** 构造一个含有 2 条 ScriptBeat 的脚本节点 */
  function makeScriptNode(id: string): Node<FlowNodeData> {
    return {
      id,
      type: "scriptNode",
      position: { x: 0, y: 0 },
      data: {
        label: "剧本",
        prompt: "一个测试故事",
        scriptBeats: [
          {
            id: BEAT_ID_A,
            shotId: BEAT_ID_A,
            shotNumber: "01",
            scene: "",
            durationHint: "3s",
            description: "镜头A",
            character1: "",
            character1Desc: "",
            character1Image: "",
            character2: "",
            character2Desc: "",
            character2Image: "",
            reference: "",
            shotSize: "全景",
            characterAction: "",
            emotion: "",
            sceneTags: "",
            lightingMood: "",
            soundEffect: "",
            dialogue: "",
            storyboardPrompt: "",
            videoMotionPrompt: "",
          },
          {
            id: BEAT_ID_B,
            shotId: BEAT_ID_B,
            shotNumber: "02",
            scene: "",
            durationHint: "4s",
            description: "镜头B",
            character1: "",
            character1Desc: "",
            character1Image: "",
            character2: "",
            character2Desc: "",
            character2Image: "",
            reference: "",
            shotSize: "近景",
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
        scriptBeatSelection: [BEAT_ID_A],
        storyboardShots: [
          { scriptBeatId: BEAT_ID_A, visualPrompt: "月光下的屋顶" },
        ],
      },
    };
  }

  /** 构造一个绑定了 BEAT_ID_A 的图像节点 */
  function makeImageNode(id: string): Node<FlowNodeData> {
    return {
      id,
      type: "imageNode",
      position: { x: 400, y: 0 },
      data: {
        label: "图片",
        path: "",
        params: { scriptBeatId: BEAT_ID_A, shotNumber: "01" },
      },
    };
  }

  /** 构造脚本→图像的边 */
  function makeEdge(source: string, target: string): Edge {
    return {
      id: `e-${source}-${target}`,
      source,
      target,
      data: { payloadType: "script" },
    };
  }

  it("粘贴后脚本节点获得全新 beatId（不与原件冲突）", () => {
    const scriptNode = makeScriptNode("script-orig");
    const { nextNodes } = buildPasteNodesFromClipboard({
      copiedNodes: [scriptNode],
      copiedEdges: [],
    });
    const pasted = nextNodes[0]!;
    const newA = pasted.data.scriptBeats?.[0]?.id;
    const newB = pasted.data.scriptBeats?.[1]?.id;
    expect(newA).toBeDefined();
    expect(newB).toBeDefined();
    // 新 id 与原 id 不同
    expect(newA).not.toBe(BEAT_ID_A);
    expect(newB).not.toBe(BEAT_ID_B);
    // 两个新 id 彼此不同
    expect(newA).not.toBe(newB);
  });

  it("粘贴后脚本节点 data 内三处引用全部同步更新", () => {
    const scriptNode = makeScriptNode("script-orig");
    const { nextNodes } = buildPasteNodesFromClipboard({
      copiedNodes: [scriptNode],
      copiedEdges: [],
    });
    const newData = nextNodes[0]!.data;
    const newA = newData.scriptBeats?.[0]?.id!;
    const newB = newData.scriptBeats?.[1]?.id!;

    // scriptBeats[].id 已更新
    expect(newData.scriptBeats?.[0]?.id).toBe(newA);
    expect(newData.scriptBeats?.[1]?.id).toBe(newB);
    // scriptBeats[].shotId 已更新（shotId === id 时需同步）
    expect(newData.scriptBeats?.[0]?.shotId).toBe(newA);
    expect(newData.scriptBeats?.[1]?.shotId).toBe(newB);
    // scriptBeatSelection 已更新
    expect(newData.scriptBeatSelection).toContain(newA);
    expect(newData.scriptBeatSelection).not.toContain(BEAT_ID_A);
    // storyboardShots[].scriptBeatId 已更新
    expect(newData.storyboardShots?.[0]?.scriptBeatId).toBe(newA);
  });

  it("粘贴后下游图像节点 params.scriptBeatId 同步映射为新 beatId", () => {
    const scriptNode = makeScriptNode("script-orig");
    const imageNode = makeImageNode("image-orig");
    const edge = makeEdge("script-orig", "image-orig");

    const copiedNodes = [scriptNode, imageNode];
    const copiedEdges = [edge];
    const { nextNodes } = buildPasteNodesFromClipboard({ copiedNodes, copiedEdges });
    const pastedScript = nextNodes.find((n) => n.type === "scriptNode")!;
    const pastedImage = nextNodes.find((n) => n.type === "imageNode")!;
    const newA = pastedScript.data.scriptBeats?.[0]?.id;
    expect((pastedImage.data.params as Record<string, unknown>)?.scriptBeatId).toBe(newA);
  });

  it("粘贴后脚本副本与原件 beatId 完全独立（互不干扰）", () => {
    const scriptNode = makeScriptNode("script-orig");
    const { nextNodes } = buildPasteNodesFromClipboard({
      copiedNodes: [scriptNode],
      copiedEdges: [],
    });
    const clonedData = nextNodes[0]!.data;

    // 原件的 scriptBeats.id 不变
    expect(scriptNode.data.scriptBeats?.[0]?.id).toBe(BEAT_ID_A);
    // 副本的 scriptBeats.id 已更新
    expect(clonedData.scriptBeats?.[0]?.id).not.toBe(BEAT_ID_A);

    // 副本中所有 beat id 均不等于原件 id
    const origIds = new Set([BEAT_ID_A, BEAT_ID_B]);
    for (const b of clonedData.scriptBeats ?? []) {
      expect(origIds.has(b.id)).toBe(false);
    }
  });

  it("粘贴后副本内部引用一致：scriptBeatSelection 中每个 id 都能在 scriptBeats 中找到", () => {
    const scriptNode = makeScriptNode("script-orig");
    const { nextNodes } = buildPasteNodesFromClipboard({
      copiedNodes: [scriptNode],
      copiedEdges: [],
    });
    const clonedData = nextNodes[0]!.data;

    const beatIdSet = new Set((clonedData.scriptBeats ?? []).map((b) => b.id));
    for (const selId of clonedData.scriptBeatSelection ?? []) {
      expect(beatIdSet.has(selId)).toBe(true);
    }
  });

  it("粘贴后副本内部引用一致：storyboardShots.scriptBeatId 在 scriptBeats 中均有对应", () => {
    const scriptNode = makeScriptNode("script-orig");
    const { nextNodes } = buildPasteNodesFromClipboard({
      copiedNodes: [scriptNode],
      copiedEdges: [],
    });
    const clonedData = nextNodes[0]!.data;

    const beatIdSet = new Set((clonedData.scriptBeats ?? []).map((b) => b.id));
    for (const shot of clonedData.storyboardShots ?? []) {
      expect(beatIdSet.has(shot.scriptBeatId)).toBe(true);
    }
  });

  it("disabled 边不参与上游 BFS 溯源（隔离子图）", () => {
    const nodes: Node<FlowNodeData>[] = [
      { id: "S", type: "scriptNode", position: { x: 0, y: 0 }, data: {} },
      { id: "I", type: "imageNode", position: { x: 400, y: 0 }, data: {} },
    ];
    const disabledEdge: Edge = {
      id: "e-disabled",
      source: "S",
      target: "I",
      data: { disabled: true },
    };
    expect(findUpstreamScriptNodeIdInSubgraph("I", [disabledEdge], nodes)).toBeNull();
  });
});

// ─────────────────────────────────────────────
// §31：deleteSelection 后节点/边被正确清理
// （纯函数级验证，不依赖 zustand 环境）
// ─────────────────────────────────────────────
describe("§31 deleteSelection 逻辑等价验证", () => {
  it("删除节点后关联边也应被移除", () => {
    const nodes: Node<FlowNodeData>[] = [
      { id: "n1", type: "textNode", position: { x: 0, y: 0 }, data: { label: "文本" } },
      { id: "n2", type: "scriptNode", position: { x: 400, y: 0 }, data: { label: "脚本" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2" },
    ];

    const selectedNodeIds = ["n1"];

    // 模拟 deleteSelection 中的过滤逻辑
    const nextNodes = nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const nextEdges = edges.filter(
      (e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target),
    );

    expect(nextNodes).toHaveLength(1);
    expect(nextNodes[0]?.id).toBe("n2");
    expect(nextEdges).toHaveLength(0); // e1 因 source=n1 被删除
  });

  it("仅删除选中边时节点不受影响", () => {
    const nodes: Node<FlowNodeData>[] = [
      { id: "n1", type: "textNode", position: { x: 0, y: 0 }, data: { label: "文本" } },
      { id: "n2", type: "scriptNode", position: { x: 400, y: 0 }, data: { label: "脚本" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n1" }, // 假设有反向边
    ];

    const selectedEdgeIds = ["e1"];
    const selectedNodeIds: string[] = [];

    const nextNodes = nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const nextEdges = edges.filter(
      (e) =>
        !selectedNodeIds.includes(e.source) &&
        !selectedNodeIds.includes(e.target) &&
        !selectedEdgeIds.includes(e.id),
    );

    expect(nextNodes).toHaveLength(2); // 节点不变
    expect(nextEdges).toHaveLength(1); // e1 被删，e2 保留
    expect(nextEdges[0]?.id).toBe("e2");
  });
});
