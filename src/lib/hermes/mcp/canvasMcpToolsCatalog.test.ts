import { describe, expect, it } from "vitest";
import {
  buildCursorMcpServerConfigSnippet,
  canvasMcpNameToToolId,
  listCanvasMcpCatalogTools,
} from "@/lib/hermes/mcp/canvasMcpToolsCatalog";

describe("canvasMcpToolsCatalog", () => {
  it("lists tools with toolId mapping", () => {
    const tools = listCanvasMcpCatalogTools();
    expect(tools.length).toBeGreaterThan(5);
    expect(canvasMcpNameToToolId("script_generate_storyboard")).toBe(
      "script.generate_storyboard",
    );
  });

  it("buildCursorMcpServerConfigSnippet uses node command", () => {
    const json = buildCursorMcpServerConfigSnippet("D:/vibevideo/scripts/canvasflow-mcp-server.mjs");
    expect(json).toContain("canvasflow");
    expect(json).toContain("canvasflow-mcp-server.mjs");
  });
});
