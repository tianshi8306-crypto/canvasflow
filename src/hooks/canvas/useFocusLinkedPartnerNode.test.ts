import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import type { FlowNodeData } from "@/lib/types";
import { useFocusLinkedPartnerNode } from "./useFocusLinkedPartnerNode";

const fitViewToNode = vi.fn(async () => {});

vi.mock("@/hooks/canvas/useFitView", () => ({
  useFitView: () => ({ fitViewToNode }),
}));

function partnerNode(
  id: string,
  type: string,
  data: Partial<FlowNodeData> = {},
): Node<FlowNodeData> {
  return {
    id,
    type: type as Node<FlowNodeData>["type"],
    position: { x: 0, y: 0 },
    data: data as FlowNodeData,
  } as Node<FlowNodeData>;
}

describe("useFocusLinkedPartnerNode", () => {
  beforeEach(() => {
    fitViewToNode.mockClear();
    useProjectStore.setState({
      nodes: [
        partnerNode("a1", "audioNode", { label: "配音轨" }),
        partnerNode("v1", "videoNode", { label: "主镜头" }),
        partnerNode("i1", "imageNode", {}),
        partnerNode("s1", "scriptNode", { label: "  " }),
      ],
      selectedNodeIds: ["text-1"],
      selectedNodeId: "text-1",
      statusText: "",
    });
    useCanvasUiStore.setState({
      audioTtsPanelNodeId: null,
      audioTtsPanelPinnedNodeId: null,
      videoGenPanelPinnedNodeId: null,
      imageGenPanelPinnedNodeId: null,
    });
  });

  it("returns false when partner node is missing", async () => {
    const { result } = renderHook(() => useFocusLinkedPartnerNode());

    let ok = true;
    await act(async () => {
      ok = await result.current.focusPartnerNode("ghost");
    });

    expect(ok).toBe(false);
    expect(useProjectStore.getState().statusText).toBe("关联节点不存在或已删除");
    expect(fitViewToNode).not.toHaveBeenCalled();
    expect(useProjectStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });

  it("selects partner, fits view, and sets success status (default kind)", async () => {
    const { result } = renderHook(() => useFocusLinkedPartnerNode());

    let ok = false;
    await act(async () => {
      ok = await result.current.focusPartnerNode("v1");
    });

    expect(ok).toBe(true);
    expect(useProjectStore.getState().selectedNodeIds).toEqual(["v1"]);
    expect(fitViewToNode).toHaveBeenCalledWith("v1");
    expect(useProjectStore.getState().statusText).toBe("已定位到「主镜头」");
    expect(useCanvasUiStore.getState().audioTtsPanelNodeId).toBeNull();
    expect(useCanvasUiStore.getState().videoGenPanelPinnedNodeId).toBeNull();
    expect(useCanvasUiStore.getState().imageGenPanelPinnedNodeId).toBeNull();
  });

  it("uses custom label when provided", async () => {
    const { result } = renderHook(() => useFocusLinkedPartnerNode());

    await act(async () => {
      await result.current.focusPartnerNode("v1", { label: "自定义名" });
    });

    expect(useProjectStore.getState().statusText).toBe("已定位到「自定义名」");
  });

  it("falls back to node type when label is empty", async () => {
    const { result } = renderHook(() => useFocusLinkedPartnerNode());

    await act(async () => {
      await result.current.focusPartnerNode("i1");
    });

    expect(useProjectStore.getState().statusText).toBe("已定位到「imageNode」");
  });

  it("pins audio TTS panel for audio kind", async () => {
    const { result } = renderHook(() => useFocusLinkedPartnerNode());

    await act(async () => {
      await result.current.focusPartnerNode("a1", { kind: "audio" });
    });

    expect(useCanvasUiStore.getState().audioTtsPanelNodeId).toBe("a1");
    expect(useCanvasUiStore.getState().audioTtsPanelPinnedNodeId).toBe("a1");
    expect(useCanvasUiStore.getState().videoGenPanelPinnedNodeId).toBeNull();
    expect(useCanvasUiStore.getState().imageGenPanelPinnedNodeId).toBeNull();
  });

  it("pins video gen panel for video kind", async () => {
    const { result } = renderHook(() => useFocusLinkedPartnerNode());

    await act(async () => {
      await result.current.focusPartnerNode("v1", { kind: "video" });
    });

    expect(useCanvasUiStore.getState().videoGenPanelPinnedNodeId).toBe("v1");
    expect(useCanvasUiStore.getState().audioTtsPanelNodeId).toBeNull();
    expect(useCanvasUiStore.getState().imageGenPanelPinnedNodeId).toBeNull();
  });

  it("pins image gen panel for image kind", async () => {
    const { result } = renderHook(() => useFocusLinkedPartnerNode());

    await act(async () => {
      await result.current.focusPartnerNode("i1", { kind: "image" });
    });

    expect(useCanvasUiStore.getState().imageGenPanelPinnedNodeId).toBe("i1");
    expect(useCanvasUiStore.getState().audioTtsPanelNodeId).toBeNull();
    expect(useCanvasUiStore.getState().videoGenPanelPinnedNodeId).toBeNull();
  });

  it("falls back to node id when label is whitespace-only", async () => {
    const { result } = renderHook(() => useFocusLinkedPartnerNode());

    await act(async () => {
      await result.current.focusPartnerNode("s1");
    });

    expect(useProjectStore.getState().statusText).toBe("已定位到「scriptNode」");
  });
});
