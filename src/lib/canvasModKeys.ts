/** 画布快捷键展示与组合键检测（Mac 用 ⌘ 替代 Ctrl） */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform ?? "");
}

export type ModToken = "mod" | "shift" | "alt";

export function modGlyph(): "⌘" | "Ctrl" {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

export function formatShortcutParts(tokens: Array<ModToken | string>): string[] {
  const mac = isMacPlatform();
  return tokens.map((t) => {
    if (t === "mod") return mac ? "⌘" : "Ctrl";
    if (t === "shift") return mac ? "⇧" : "Shift";
    if (t === "alt") return mac ? "⌥" : "Alt";
    return t;
  });
}

export function canvasEditHints() {
  const mac = isMacPlatform();
  return {
    copy: mac ? "⌘C" : "Ctrl+C",
    paste: mac ? "⌘V" : "Ctrl+V",
    del: mac ? "⌫" : "Del",
    undo: mac ? "⌘Z" : "Ctrl+Z",
    redo: mac ? "⇧⌘Z" : "Ctrl+Shift+Z",
    group: mac ? "⌘G" : "Ctrl+G",
    ungroup: mac ? "⌥⇧⌘G" : "Ctrl+Alt+Shift+G",
    dup: mac ? "⇧⌘C" : "Ctrl+Shift+C",
    generate: mac ? "⌘↩" : "Ctrl+Enter",
    textComposer: mac ? "⇧⌘G" : "Ctrl+Shift+G",
    newProject: mac ? "⌘N" : "Ctrl+N",
    openProject: mac ? "⌘O" : "Ctrl+O",
    saveProject: mac ? "⌘S" : "Ctrl+S",
    zoomIn: mac ? "⌘+" : "Ctrl++",
    zoomOut: mac ? "⌘-" : "Ctrl+-",
    fitZoom: mac ? "⌘0" : "Ctrl+0",
  };
}
