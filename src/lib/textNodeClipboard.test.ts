import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextAsFile, readClipboardText, writeClipboardText } from "./textNodeClipboard";

describe("textNodeClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("readClipboardText delegates to navigator.clipboard.readText", async () => {
    const readText = vi.fn().mockResolvedValue("hello");
    vi.stubGlobal("navigator", { clipboard: { readText } });

    await expect(readClipboardText()).resolves.toBe("hello");
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("writeClipboardText delegates to navigator.clipboard.writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await writeClipboardText("abc");
    expect(writeText).toHaveBeenCalledWith("abc");
  });

  it("downloadTextAsFile creates anchor and revokes URL", () => {
    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
    };
    const createElement = vi.fn().mockReturnValue(anchor);
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("document", { createElement });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    downloadTextAsFile("body", "demo.txt");

    expect(createElement).toHaveBeenCalledWith("a");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchor.href).toBe("blob:mock");
    expect(anchor.download).toBe("demo.txt");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
