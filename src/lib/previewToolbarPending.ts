/** 预览顶栏占位项：灰色禁用，不触发 toast */
export const PREVIEW_TOOLBAR_PENDING_LABEL = "待开发";

export function previewToolbarPendingTitle(stubMessage?: string): string {
  return stubMessage?.trim() || PREVIEW_TOOLBAR_PENDING_LABEL;
}

export function isPreviewToolbarActionPending(kind: string): boolean {
  return kind === "stub";
}
