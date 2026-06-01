/**
 * 计算 textarea 内某一字符偏移处的像素坐标（相对 textarea 元素左上角，含边框内区域）。
 * 用于在提示词上方叠放「运镜」内联标签。
 */
export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const div = document.createElement("div");
  document.body.appendChild(div);

  const cs = window.getComputedStyle(textarea);
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.overflow = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.width = `${textarea.clientWidth}px`;
  div.style.minHeight = `${textarea.clientHeight}px`;
  div.style.height = `${Math.max(textarea.clientHeight, textarea.scrollHeight)}px`;
  div.style.paddingTop = cs.paddingTop;
  div.style.paddingRight = cs.paddingRight;
  div.style.paddingBottom = cs.paddingBottom;
  div.style.paddingLeft = cs.paddingLeft;
  div.style.border = "none";
  div.style.font = cs.font;
  div.style.lineHeight = cs.lineHeight;
  div.style.letterSpacing = cs.letterSpacing;
  div.style.tabSize = cs.tabSize;
  div.scrollTop = textarea.scrollTop;
  div.scrollLeft = textarea.scrollLeft;

  const val = textarea.value;
  const before = val.slice(0, Math.max(0, position));
  const after = val.slice(Math.max(0, position)) || ".";

  div.textContent = before;
  const span = document.createElement("span");
  span.textContent = after;
  div.appendChild(span);

  const top = span.offsetTop - div.scrollTop;
  const left = span.offsetLeft - div.scrollLeft;
  const lh = parseFloat(cs.lineHeight);
  const fs = parseFloat(cs.fontSize);
  const height = Number.isFinite(lh) ? lh : fs * 1.25;

  document.body.removeChild(div);

  return { top, left, height };
}

/** 根据指针位置估算最近的字符插入下标（拖动运镜标签落点） */
export function indexFromPoint(
  textarea: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
): number {
  const rect = textarea.getBoundingClientRect();
  const vx = clientX - rect.left + textarea.scrollLeft;
  const vy = clientY - rect.top + textarea.scrollTop;
  const val = textarea.value;
  const n = val.length;
  if (n === 0) return 0;

  let best = 0;
  let bestScore = Infinity;
  const step = Math.max(1, Math.floor(n / 150));
  for (let i = 0; i <= n; i += step) {
    const c = getCaretCoordinates(textarea, i);
    const dx = c.left - vx;
    const dy = c.top + c.height / 2 - vy;
    const s = dx * dx + dy * dy;
    if (s < bestScore) {
      bestScore = s;
      best = i;
    }
  }
  const lo = Math.max(0, best - step);
  const hi = Math.min(n, best + step);
  for (let i = lo; i <= hi; i++) {
    const c = getCaretCoordinates(textarea, i);
    const dx = c.left - vx;
    const dy = c.top + c.height / 2 - vy;
    const s = dx * dx + dy * dy;
    if (s < bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

/** `@` 触发符在视口中的锚点（用于浮层紧贴字符右下） */
export function getTextareaAtTriggerViewportRect(
  textarea: HTMLTextAreaElement,
  cursor: number,
): { left: number; top: number; bottom: number; atIndex: number } | null {
  const textBefore = textarea.value.slice(0, cursor);
  const atMatch = textBefore.match(/@([^@\n]*)$/);
  if (!atMatch) return null;
  const atIndex = cursor - atMatch[0].length;
  const coords = getCaretCoordinates(textarea, atIndex);
  const rect = textarea.getBoundingClientRect();
  return {
    left: rect.left + coords.left,
    top: rect.top + coords.top,
    bottom: rect.top + coords.top + coords.height,
    atIndex,
  };
}
