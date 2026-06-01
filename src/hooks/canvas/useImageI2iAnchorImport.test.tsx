import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { useImageI2iAnchorImport } from "./useImageI2iAnchorImport";

const pickImagePathsForImport = vi.fn();
const addReferenceImageNodeLeftOf = vi.fn(async () => {});

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
}));

vi.mock("@/lib/tauriMediaPaths", () => ({
  pickImagePathsForImport: (...args: unknown[]) => pickImagePathsForImport(...args),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe("useImageI2iAnchorImport", () => {
  beforeEach(() => {
    pickImagePathsForImport.mockReset();
    addReferenceImageNodeLeftOf.mockClear();
    useCanvasUiStore.setState({ imageI2iTargetNodeId: null });
    useProjectStore.setState({
      projectPath: "/proj",
      addReferenceImageNodeLeftOf,
    });
  });

  it("imports reference images when anchor targets this node", async () => {
    pickImagePathsForImport.mockResolvedValue(["/tmp/ref.png"]);

    renderHook(() => useImageI2iAnchorImport("img-1"));

    await act(async () => {
      useCanvasUiStore.setState({ imageI2iTargetNodeId: "img-1" });
      await Promise.resolve();
    });

    expect(pickImagePathsForImport).toHaveBeenCalledWith(true);
    expect(addReferenceImageNodeLeftOf).toHaveBeenCalledWith("img-1", ["/tmp/ref.png"]);
    expect(useCanvasUiStore.getState().imageI2iTargetNodeId).toBeNull();
  });

  it("ignores anchor target for other nodes", async () => {
    renderHook(() => useImageI2iAnchorImport("img-1"));

    await act(async () => {
      useCanvasUiStore.setState({ imageI2iTargetNodeId: "img-2" });
      await Promise.resolve();
    });

    expect(pickImagePathsForImport).not.toHaveBeenCalled();
    expect(addReferenceImageNodeLeftOf).not.toHaveBeenCalled();
  });
});
