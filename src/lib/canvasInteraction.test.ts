import { describe, expect, it } from "vitest";
import { isTextInputTarget } from "./canvasInteraction";

describe("isTextInputTarget", () => {
  it("detects textarea", () => {
    const ta = document.createElement("textarea");
    expect(isTextInputTarget(ta)).toBe(true);
  });

  it("detects nested content inside contenteditable", () => {
    const root = document.createElement("div");
    root.setAttribute("contenteditable", "true");
    const child = document.createElement("p");
    child.textContent = "台词";
    root.appendChild(child);
    document.body.appendChild(root);
    expect(isTextInputTarget(child)).toBe(true);
    root.remove();
  });

  it("detects mention overlay when textarea inside wrapper is focused", () => {
    const wrap = document.createElement("div");
    wrap.className = "mention-input-wrapper scriptGenComposer";
    const overlay = document.createElement("div");
    overlay.className = "mention-overlay";
    overlay.textContent = "解析要求";
    const ta = document.createElement("textarea");
    ta.className = "mention-textarea";
    wrap.append(overlay, ta);
    document.body.appendChild(wrap);
    ta.focus();
    expect(isTextInputTarget(overlay)).toBe(true);
    wrap.remove();
  });
});
