# 迭代 20 — 剪辑工作台：分割 / 修剪 / 撤销

**层**：CanvasExperienceLayer  
**目标**：时间线基础编辑工具与独立撤销栈。

## 功能

- **分割**：播放头处将片段一分为二（同素材，不同 in/out）
- **修剪入点 / 出点**：以播放头为界裁掉选中片段左侧或右侧
- **撤销 / 重做**：时间线操作栈（最多 50 步），与画布 undo 独立
- **顺序连播**：提升到工具栏主区
- 快捷键：空格播放、`S` 分割、`Del` 删除、`Ctrl+Z` / `Ctrl+Shift+Z` 撤销重做

## 模块

- `lib/compose/timelineEditOps.ts`、`timelineHistory.ts`
- `hooks/useComposeNodeEditor.ts`
- `ComposeTimelineToolbar.tsx`、`ComposeEditorBody.tsx`

## 验收

1. 两片段时间线，播放头在中间点「分割」→ 变为 3 段，导出时长正确
2. 选中片段，播放头偏右点「修剪出点」→ 该段变短
3. 删除片段后 Ctrl+Z 可恢复
4. 顺序连播按钮在播放钮旁，多段可连播

## Out of scope

- 多帧胶片、右键菜单、布局抛光（迭代 21）

## 回退

Revert 迭代 20；保留迭代 19 数据模型与 trim 导出。
