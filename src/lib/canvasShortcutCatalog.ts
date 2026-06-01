import { formatShortcutParts } from "@/lib/canvasModKeys";

export type ShortcutBinding =
  | { kind: "keys"; tokens: Array<"mod" | "shift" | "alt" | string> }
  | { kind: "hint"; text: string };

export type ShortcutEntry = {
  id: string;
  label: string;
  binding: ShortcutBinding;
};

export type ShortcutColumn = {
  id: string;
  title: string;
  entries: ShortcutEntry[];
};

export function formatBinding(binding: ShortcutBinding): string {
  if (binding.kind === "hint") return binding.text;
  return formatShortcutParts(binding.tokens).join("+");
}

/** 画布「?」浮层四列（创作 / 视图 / 对齐与整理 / 其他） */
export function buildCanvasShortcutColumns(): ShortcutColumn[] {
  return [
    {
      id: "create",
      title: "创作",
      entries: [
        { id: "group", label: "成组", binding: { kind: "keys", tokens: ["mod", "G"] } },
        {
          id: "ungroup",
          label: "解组",
          binding: { kind: "keys", tokens: ["mod", "alt", "shift", "G"] },
        },
        {
          id: "connect",
          label: "连线",
          binding: { kind: "hint", text: "拖出节点锚点" },
        },
        {
          id: "dup-selection",
          label: "复制整组",
          binding: { kind: "keys", tokens: ["mod", "shift", "C"] },
        },
        {
          id: "generate",
          label: "生成",
          binding: { kind: "keys", tokens: ["mod", "Enter"] },
        },
        {
          id: "new-node",
          label: "新建节点",
          binding: { kind: "keys", tokens: ["Tab"] },
        },
        {
          id: "alt-drag-copy",
          label: "节点复制",
          binding: { kind: "hint", text: "Alt + 拖动节点" },
        },
        {
          id: "dup-drag",
          label: "创建副本",
          binding: { kind: "hint", text: "多选工具栏 · 右键菜单" },
        },
        {
          id: "text-composer",
          label: "模型对话",
          binding: { kind: "keys", tokens: ["mod", "shift", "G"] },
        },
      ],
    },
    {
      id: "view",
      title: "视图",
      entries: [
        { id: "zoom-in", label: "放大", binding: { kind: "keys", tokens: ["mod", "+"] } },
        { id: "zoom-out", label: "缩小", binding: { kind: "keys", tokens: ["mod", "-"] } },
        { id: "fit-all", label: "适配全部节点", binding: { kind: "keys", tokens: ["Z"] } },
        { id: "fit-zoom", label: "缩放 100%", binding: { kind: "keys", tokens: ["mod", "0"] } },
        { id: "focus-node", label: "聚焦选中", binding: { kind: "keys", tokens: ["F"] } },
        { id: "wheel", label: "滚轮缩放", binding: { kind: "hint", text: "在画布上滚动" } },
        { id: "ctrl-wheel", label: "精确缩放", binding: { kind: "hint", text: "Ctrl + 滚轮" } },
        { id: "space-pan", label: "平移画布", binding: { kind: "hint", text: "Space + 左键拖拽" } },
        { id: "alt-wheel-y", label: "垂直平移", binding: { kind: "hint", text: "Alt + 滚轮" } },
        { id: "shift-wheel-x", label: "水平平移", binding: { kind: "hint", text: "Shift + 滚轮" } },
        { id: "trackpad-pan", label: "触控板", binding: { kind: "hint", text: "双指拖移" } },
      ],
    },
    {
      id: "align",
      title: "对齐与整理",
      entries: [
        { id: "marquee", label: "框选", binding: { kind: "hint", text: "空白左拖 · Shift 点选" } },
        { id: "marquee-rmb", label: "右键框选", binding: { kind: "hint", text: "空白处右键拖选" } },
        { id: "tidy", label: "整理画布（宫格）", binding: { kind: "keys", tokens: ["alt", "shift", "F"] } },
        { id: "minimap", label: "小地图", binding: { kind: "keys", tokens: ["alt", "shift", "M"] } },
        { id: "snap", label: "对齐吸附", binding: { kind: "keys", tokens: ["alt", "shift", "S"] } },
        { id: "snap-grid", label: "网格吸附", binding: { kind: "keys", tokens: ["alt", "shift", "G"] } },
        {
          id: "nudge",
          label: "微调选中",
          binding: { kind: "hint", text: "方向键 · Shift + 方向键（10px）" },
        },
        { id: "align-left", label: "左对齐", binding: { kind: "keys", tokens: ["alt", "shift", "L"] } },
        { id: "align-center-h", label: "水平居中", binding: { kind: "keys", tokens: ["alt", "shift", "H"] } },
        { id: "align-center-v", label: "垂直居中", binding: { kind: "keys", tokens: ["alt", "shift", "V"] } },
        { id: "distribute-h", label: "水平等距", binding: { kind: "keys", tokens: ["alt", "shift", "E"] } },
      ],
    },
    {
      id: "other",
      title: "其他",
      entries: [
        { id: "undo", label: "撤销", binding: { kind: "keys", tokens: ["mod", "Z"] } },
        {
          id: "redo",
          label: "重做",
          binding: { kind: "keys", tokens: ["mod", "shift", "Z"] },
        },
        { id: "delete", label: "删除", binding: { kind: "keys", tokens: ["Del"] } },
        { id: "copy", label: "复制", binding: { kind: "keys", tokens: ["mod", "C"] } },
        { id: "paste", label: "粘贴", binding: { kind: "keys", tokens: ["mod", "V"] } },
        {
          id: "dbl-pane",
          label: "添加节点",
          binding: { kind: "hint", text: "双击画布空白" },
        },
        {
          id: "dbl-node",
          label: "节点居中",
          binding: { kind: "hint", text: "双击节点" },
        },
        { id: "new-proj", label: "新建工程", binding: { kind: "keys", tokens: ["mod", "N"] } },
        { id: "open-proj", label: "打开工程", binding: { kind: "keys", tokens: ["mod", "O"] } },
        { id: "save-proj", label: "保存工程", binding: { kind: "keys", tokens: ["mod", "S"] } },
        {
          id: "help",
          label: "快捷键说明",
          binding: { kind: "keys", tokens: ["?"] },
        },
      ],
    },
  ];
}

