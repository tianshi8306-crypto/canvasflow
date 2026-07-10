/** 在 contentEditable 文档面上执行排版（与工具条命令一致） */
export function applyFormatExec(command: string, value?: string): boolean {
  if (typeof document === "undefined") return false;

  if (command === "formatBlock") {
    const block = value === "p" ? "p" : value ?? "p";
    return document.execCommand("formatBlock", false, block);
  }
  if (command === "bold") return document.execCommand("bold");
  if (command === "italic") return document.execCommand("italic");
  if (command === "insertUnorderedList") return document.execCommand("insertUnorderedList");
  if (command === "insertOrderedList") return document.execCommand("insertOrderedList");
  if (command === "insertHorizontalRule") return document.execCommand("insertHorizontalRule");
  if (command === "clearFormat") return document.execCommand("removeFormat");
  return false;
}
