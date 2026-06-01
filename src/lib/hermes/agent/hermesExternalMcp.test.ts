import { describe, expect, it } from "vitest";
import {
  enabledHermesMcpServers,
  parseExternalMcpInvokeMessage,
} from "@/lib/hermes/agent/hermesExternalMcp";

describe("hermesExternalMcp", () => {
  it("parseExternalMcpInvokeMessage", () => {
    const p = parseExternalMcpInvokeMessage(
      '调用 mcp Filesystem list_directory {"path":"."}',
    );
    expect(p?.serverLabel).toBe("Filesystem");
    expect(p?.toolName).toBe("list_directory");
    expect(p?.argsJson).toContain("path");
  });

  it("enabledHermesMcpServers filters disabled", () => {
    const list = enabledHermesMcpServers({
      hermesMcpServers: [
        { id: "1", label: "A", command: "npx", args: [], env: {}, enabled: false },
        { id: "2", label: "B", command: "node", args: [], env: {}, enabled: true },
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0]!.label).toBe("B");
  });
});
