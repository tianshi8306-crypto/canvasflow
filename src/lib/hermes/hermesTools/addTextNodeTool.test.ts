import { describe, expect, it, beforeEach } from "vitest";
import { runAddTextNodeTool } from "@/lib/hermes/hermesTools/addTextNodeTool";
import { useProjectStore } from "@/store/projectStore";

describe("runAddTextNodeTool", () => {
  beforeEach(() => {
    useProjectStore.setState({
      nodes: [],
      edges: [],
      projectPath: "/proj",
    });
  });

  it("creates textNode on canvas", () => {
    const result = runAddTextNodeTool({ initialPrompt: "开场旁白" });
    expect(result.ok).toBe(true);
    const nodes = useProjectStore.getState().nodes;
    expect(nodes.some((n) => n.type === "textNode")).toBe(true);
    expect(nodes.find((n) => n.type === "textNode")?.data.prompt).toBe("开场旁白");
  });

  it("requires project", () => {
    useProjectStore.setState({ projectPath: null });
    const result = runAddTextNodeTool();
    expect(result.ok).toBe(false);
  });
});
