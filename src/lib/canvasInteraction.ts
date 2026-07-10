/**
 * 用于节点内可编辑区域：配合 React Flow 的 noWheel / noPan / noDrag 机制，
 * 避免滚轮缩放画布、拖拽误平移、拖节点与文本选择冲突。
 * @see https://reactflow.dev/learn/troubleshooting/common-issues#preventing-zoom--pan--scroll
 */
export const RF_NODE_INPUT_CLASS = "nodrag nopan nowheel";

/** 节点外侧连接锚点热区：禁止拖节点/平移画布，拖线由 Handle 承接 */
export const RF_NODE_ANCHOR_CLASS = "nodrag nopan";

const TEXT_INPUT_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']";

/** Portaled 节点底栏：事件 target 可能是 mention 镜像层，真实焦点在同级 textarea */
const COMPOSER_PANEL_SELECTOR =
  ".mention-input-wrapper, .scriptGenComposer, .textGenPanel--chrome, .imageGenPanel--minimal-inner, .nodeFloatingBottomPanel";

function isEditableElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return true;
  }
  let node: HTMLElement | null = el;
  while (node) {
    if (node.isContentEditable) return true;
    node = node.parentElement;
  }
  return Boolean(el.closest(TEXT_INPUT_SELECTOR));
}

function isComposerPanelEditing(el: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) {
    return false;
  }
  const activeRoot = active.closest(COMPOSER_PANEL_SELECTOR);
  if (!activeRoot) return false;
  if (!el) return true;
  const targetRoot = el.closest(COMPOSER_PANEL_SELECTOR);
  return !targetRoot || targetRoot === activeRoot;
}

/** Delete/Backspace 应交给输入控件，不触发画布删除选区 */
export function isTextInputTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (isEditableElement(el)) return true;
  if (isComposerPanelEditing(el)) return true;
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== el && isEditableElement(active)) return true;
  return false;
}
