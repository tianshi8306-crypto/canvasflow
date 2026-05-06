/**
 * 行内运镜编辑器：用 caretRangeFromPoint / caretPositionFromPoint 将指针位置映射为 prompt 中的字符下标。
 */

export function getCaretRangeFromPoint(clientX: number, clientY: number): Range | null {
  const d = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof d.caretRangeFromPoint === "function") {
    return d.caretRangeFromPoint(clientX, clientY);
  }
  const pos = d.caretPositionFromPoint?.(clientX, clientY);
  if (pos?.offsetNode) {
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    return range;
  }
  return null;
}

/** 将选区起点映射为「左段 + 右段」拼接串中的偏移（运镜块不占字符位） */
export function getPromptIndexFromCaretRange(
  range: Range,
  leftSpan: HTMLElement,
  chipEl: HTMLElement,
  rightSpan: HTMLElement,
): number {
  const { startContainer, startOffset } = range;
  const leftLen = leftSpan.textContent?.length ?? 0;

  if (leftSpan.contains(startContainer)) {
    const r = document.createRange();
    r.selectNodeContents(leftSpan);
    r.setEnd(startContainer, startOffset);
    return r.toString().length;
  }
  if (chipEl.contains(startContainer) || chipEl === startContainer) {
    return leftLen;
  }
  if (rightSpan.contains(startContainer)) {
    const r = document.createRange();
    r.selectNodeContents(rightSpan);
    r.setEnd(startContainer, startOffset);
    return leftLen + r.toString().length;
  }
  return leftLen;
}

/** 当前选区起点在合并 prompt 中的下标（用于 getSelectionStart） */
export function getPromptIndexFromSelection(
  editor: HTMLElement,
  leftSpan: HTMLElement,
  chipEl: HTMLElement,
  rightSpan: HTMLElement,
): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return 0;
  return getPromptIndexFromCaretRange(range, leftSpan, chipEl, rightSpan);
}
