import { describe, expect, it } from "vitest";
import {
  classifyHermesComposerFileName,
  firstSupportedComposerPasteFile,
  isHermesComposerSupportedFileName,
} from "@/lib/hermes/hermesComposerFileAttach";

describe("hermesComposerFileAttach", () => {
  it("classifies script and model-config extensions", () => {
    expect(classifyHermesComposerFileName("剧本.txt")).toBe("script");
    expect(classifyHermesComposerFileName("outline.md")).toBe("script");
    expect(classifyHermesComposerFileName("draft.docx")).toBe("script");
    expect(classifyHermesComposerFileName(".env")).toBe("model-config");
    expect(classifyHermesComposerFileName("keys.env")).toBe("model-config");
    expect(classifyHermesComposerFileName("providers.json")).toBe("model-config");
    expect(classifyHermesComposerFileName("photo.png")).toBeNull();
  });

  it("isHermesComposerSupportedFileName mirrors classifier", () => {
    expect(isHermesComposerSupportedFileName("a.txt")).toBe(true);
    expect(isHermesComposerSupportedFileName("b.pdf")).toBe(false);
  });

  it("firstSupportedComposerPasteFile picks first supported file", () => {
    const files = [
      new File(["x"], "notes.pdf", { type: "application/pdf" }),
      new File(["y"], "script.md", { type: "text/markdown" }),
    ];
    expect(firstSupportedComposerPasteFile(files)?.name).toBe("script.md");
  });
});
