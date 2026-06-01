export type ScriptPreviewToolbarActionKind = "agent" | "navigation" | "utility";

export type ScriptPreviewToolbarAction = {
  id: string;
  label: string;
  kind: ScriptPreviewToolbarActionKind;
};

export type ScriptPreviewToolbarGroup = {
  id: string;
  label: string;
  actions: ScriptPreviewToolbarAction[];
};

/** 脚本节点顶栏（有镜头 + 单选选中时） */
export const SCRIPT_PREVIEW_TOOLBAR_GROUPS: ScriptPreviewToolbarGroup[] = [
  {
    id: "gen",
    label: "生成",
    actions: [
      { id: "regen", label: "重新解析", kind: "agent" },
      { id: "storyboard", label: "生成分镜", kind: "agent" },
    ],
  },
  {
    id: "view",
    label: "视图",
    actions: [
      { id: "fullscreen", label: "全屏表格", kind: "navigation" },
      { id: "openComposer", label: "编辑主题", kind: "navigation" },
    ],
  },
  {
    id: "export",
    label: "导出",
    actions: [{ id: "exportJson", label: "导出 JSON", kind: "utility" }],
  },
];
