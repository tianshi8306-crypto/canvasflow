export type TextPreviewToolbarGroup = {
  id: string;
  label: string;
};

/** 文本节点预览顶栏：仅格式（图一硬抄，文档/工作流/素材已移除） */
export const TEXT_PREVIEW_TOOLBAR_GROUPS: TextPreviewToolbarGroup[] = [
  { id: "format", label: "格式" },
];
