import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";

export type HermesMcpServerConfig = {
  id: string;
  label: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
};

export type McpToolDescriptor = {
  name: string;
  description?: string | null;
  inputSchema?: Record<string, unknown>;
};

export type McpCallToolResult = {
  content: string;
  isError: boolean;
};

const toolListCache = new Map<string, { tools: McpToolDescriptor[]; at: number }>();
const CACHE_TTL_MS = 5 * 60_000;

export function enabledHermesMcpServers(
  settings: Pick<AppSettings, "hermesMcpServers"> | null | undefined,
): HermesMcpServerConfig[] {
  return (settings?.hermesMcpServers ?? []).filter((s) => s.enabled && s.command.trim());
}

export function newHermesMcpServerId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultHermesMcpServer(): HermesMcpServerConfig {
  return {
    id: newHermesMcpServerId(),
    label: "Filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    env: {},
    enabled: true,
  };
}

export async function listExternalMcpTools(
  serverId: string,
  opts?: { force?: boolean },
): Promise<McpToolDescriptor[]> {
  if (!isTauri()) return [];
  const cached = toolListCache.get(serverId);
  if (!opts?.force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.tools;
  }
  const tools = await invoke<McpToolDescriptor[]>("hermes_mcp_list_tools", { serverId });
  toolListCache.set(serverId, { tools, at: Date.now() });
  return tools;
}

export async function callExternalMcpTool(
  serverId: string,
  toolName: string,
  argumentsJson?: Record<string, unknown>,
): Promise<McpCallToolResult> {
  if (!isTauri()) {
    return { content: "仅桌面端可用", isError: true };
  }
  return invoke<McpCallToolResult>("hermes_mcp_call_tool", {
    serverId,
    toolName,
    arguments: argumentsJson ?? {},
  });
}

export async function probeExternalMcpServer(
  config: HermesMcpServerConfig,
): Promise<number> {
  if (!isTauri()) return 0;
  return invoke<number>("hermes_mcp_probe_server", { config });
}

export function formatExternalMcpToolsForPrompt(
  servers: HermesMcpServerConfig[],
  toolsByServer: Map<string, McpToolDescriptor[]>,
): string {
  if (servers.length === 0) return "";
  const lines: string[] = [
    "外接 MCP 工具（stdio 子进程；Hermes 可按需调用，不替代画布 SSOT）：",
  ];
  for (const s of servers) {
    const tools = toolsByServer.get(s.id) ?? [];
    if (tools.length === 0) {
      lines.push(`· [${s.label}] 暂无可用工具（可在设置中测试连接）`);
      continue;
    }
    lines.push(`· [${s.label}]`);
    for (const t of tools.slice(0, 12)) {
      const desc = t.description?.trim() ? ` — ${t.description.trim()}` : "";
      lines.push(`  - ${t.name}${desc}`);
    }
    if (tools.length > 12) {
      lines.push(`  - …共 ${tools.length} 个工具`);
    }
  }
  return lines.join("\n");
}

export async function loadExternalMcpToolsMap(
  servers: HermesMcpServerConfig[],
): Promise<Map<string, McpToolDescriptor[]>> {
  const map = new Map<string, McpToolDescriptor[]>();
  for (const s of servers) {
    try {
      const tools = await listExternalMcpTools(s.id);
      map.set(s.id, tools);
    } catch {
      map.set(s.id, []);
    }
  }
  return map;
}

/** 解析「调用 mcp <服务名> <工具名>」类话术 */
export function parseExternalMcpInvokeMessage(text: string): {
  serverLabel: string;
  toolName: string;
  argsJson?: string;
} | null {
  const m = text.trim().match(/^调用\s*mcp\s+(\S+)\s+(\S+)(?:\s+(.+))?$/i);
  if (!m) return null;
  return {
    serverLabel: m[1]!,
    toolName: m[2]!,
    argsJson: m[3]?.trim(),
  };
}

export function findMcpServerByLabelOrId(
  servers: HermesMcpServerConfig[],
  token: string,
): HermesMcpServerConfig | undefined {
  const t = token.trim().toLowerCase();
  return servers.find(
    (s) => s.id.toLowerCase() === t || s.label.trim().toLowerCase() === t,
  );
}
