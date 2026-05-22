export type ShortcutKey = {
  id: string;
  key: string;
  action: string;
  category: string;
};

export const shortcuts: ShortcutKey[] = [
  // 编辑操作
  { id: "undo", key: "Ctrl + Z", action: "撤销", category: "编辑" },
  { id: "redo", key: "Ctrl + Y", action: "重做", category: "编辑" },
  { id: "copy", key: "Ctrl + C", action: "复制", category: "编辑" },
  { id: "paste", key: "Ctrl + V", action: "粘贴", category: "编辑" },
  { id: "delete", key: "Delete", action: "删除选中节点", category: "编辑" },
  { id: "group", key: "Ctrl + G", action: "成组", category: "编辑" },

  // 文件操作
  { id: "newProject", key: "Ctrl + N", action: "新建工程", category: "文件" },
  { id: "openProject", key: "Ctrl + O", action: "打开工程", category: "文件" },
  { id: "saveProject", key: "Ctrl + S", action: "保存工程", category: "文件" },

  // 视图操作
  { id: "zoomIn", key: "Ctrl + =", action: "放大画布", category: "视图" },
  { id: "zoomOut", key: "Ctrl + -", action: "缩小画布", category: "视图" },
  { id: "resetZoom", key: "Ctrl + 0", action: "重置缩放", category: "视图" },
];

export const shortcutsByCategory = shortcuts.reduce((acc, shortcut) => {
  if (!acc[shortcut.category]) {
    acc[shortcut.category] = [];
  }
  acc[shortcut.category].push(shortcut);
  return acc;
}, {} as Record<string, ShortcutKey[]>);