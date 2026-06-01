import { describe, expect, it } from "vitest";
import {
  resolveTemplateChatIntent,
  runTemplateChatAction,
} from "@/lib/hermes/hermesTemplateChat";

describe("hermesTemplateChat", () => {
  it("detects list intent", () => {
    expect(resolveTemplateChatIntent("有哪些模板")).toBe("list");
    expect(resolveTemplateChatIntent("跑模板 分镜出图")).toBe(null);
  });

  it("lists templates in chat", () => {
    const r = runTemplateChatAction("list", "有哪些模板", null);
    expect(r.kind).toBe("list");
    expect(r.message).toContain("创意到成片");
  });

  it("save requires last plan", () => {
    const r = runTemplateChatAction("save", "保存模板为「测试流」", null);
    expect(r.kind).toBe("save");
    if (r.kind === "save") expect(r.ok).toBe(false);
  });
});
