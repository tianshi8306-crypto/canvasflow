/**
 * Canvas MCP 桥：将 Hermes 制片工具暴露为 MCP 风格工具表，供 LLM 规划与外部 MCP 对齐。
 * 执行仍走 runHermesTool（画布 SSOT）。
 */
import type { HermesPlanStep, HermesToolId, HermesToolRunResult } from "@/lib/hermes/hermesDirectorTypes";
import {
  canvasMcpNameToToolId,
  listCanvasMcpCatalogTools,
} from "@/lib/hermes/mcp/canvasMcpToolsCatalog";
import { formatHermesToolRegistryForPrompt } from "@/lib/hermes/mcp/hermesToolRegistry";
import { runHermesTool } from "@/lib/hermes/hermesTools/runHermesTool";

export type HermesCanvasMcpTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export function listHermesCanvasMcpTools(): HermesCanvasMcpTool[] {
  return listCanvasMcpCatalogTools().map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
  }));
}

export function formatHermesCanvasMcpForPrompt(): string {
  return formatHermesToolRegistryForPrompt();
}

export { formatHermesToolRegistryForPrompt } from "@/lib/hermes/mcp/hermesToolRegistry";

export function mcpNameToToolId(name: string): HermesToolId | null {
  const id = canvasMcpNameToToolId(name);
  return id ? (id as HermesToolId) : null;
}

export async function invokeHermesCanvasMcpTool(
  name: string,
  args: Record<string, unknown> | undefined,
  opts: {
    sourceMessage: string;
    scriptNodeId?: string | null;
    referenceRelPaths?: string[];
  },
): Promise<HermesToolRunResult> {
  const toolId = mcpNameToToolId(name);
  if (!toolId) {
    return { ok: false, message: `未知 MCP 工具：${name}` };
  }
  const step: HermesPlanStep = {
    id: crypto.randomUUID(),
    toolId,
    label: name,
    args,
  };
  return runHermesTool(step, opts);
}
