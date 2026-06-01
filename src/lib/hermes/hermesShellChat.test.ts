import { describe, expect, it } from "vitest";
import { hermesChatStorageScope } from "@/lib/hermes/hermesChatScope";
import {
  messageForShellChatIntent,
  resolveShellChatIntent,
} from "@/lib/hermes/hermesShellChat";

describe("hermesShellChat", () => {
  it("detects clear history", () => {
    expect(resolveShellChatIntent("清空对话")).toBe("clear_history");
    expect(resolveShellChatIntent("新对话")).toBe("clear_history");
    expect(resolveShellChatIntent("分镜出图")).toBe(null);
  });

  it("scopes storage by project and tab", () => {
    expect(hermesChatStorageScope("/p/a", "tab-1")).not.toBe(
      hermesChatStorageScope("/p/a", "tab-2"),
    );
  });

  it("clear message mentions scope", () => {
    const msg = messageForShellChatIntent("clear_history", {
      projectPath: "/p/x",
      tabName: "画布 1",
      cleared: true,
    });
    expect(msg).toContain("已清空");
    expect(msg).toContain("Tab");
  });
});
