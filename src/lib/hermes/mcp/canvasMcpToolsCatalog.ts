import catalogJson from "@/lib/hermes/mcp/canvasMcpTools.catalog.json";

export type CanvasMcpCatalogTool = {
  name: string;
  toolId: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type CanvasMcpToolsCatalog = {
  version: number;
  tools: CanvasMcpCatalogTool[];
};

export const CANVAS_MCP_TOOLS_CATALOG = catalogJson as CanvasMcpToolsCatalog;

export const CANVAS_MCP_BRIDGE_PORT = 14230;

export function listCanvasMcpCatalogTools(): CanvasMcpCatalogTool[] {
  return CANVAS_MCP_TOOLS_CATALOG.tools;
}

export function canvasMcpNameToToolId(name: string): string | null {
  const hit = CANVAS_MCP_TOOLS_CATALOG.tools.find((t) => t.name === name.trim());
  return hit?.toolId ?? null;
}

/** Cursor / Claude Desktop MCP 配置片段（stdio 子进程） */
export function buildCursorMcpServerConfigSnippet(scriptPath: string): string {
  const normalized = scriptPath.replace(/\\/g, "/");
  return JSON.stringify(
    {
      mcpServers: {
        canvasflow: {
          command: "node",
          args: [normalized],
        },
      },
    },
    null,
    2,
  );
}
