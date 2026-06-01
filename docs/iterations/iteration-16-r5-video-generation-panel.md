# 迭代 16 — R5 视频生成参数面板与状态轨

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-21**

## 1) 本轮目标（一句话）

将视频多模态面板的**生成状态**（进度 / 成功 / 失败 / 校验）固定在**输出参数栏上方**，并补齐输出参数分组标题。

## 2) 变更范围（最多 3 个模块）

- `VideoMultimodalInputPanel.tsx` + 新建 `VideoGenerationStatusRail.tsx`
- `VideoOutputSettingsContent.tsx`（Popover 分组）
- `global.css` / `MinimalVideoNode.css`（状态轨与分区标签）

## 3) 功能清单

- 抽取 `VideoGenerationStatusRail`，Portal / 展开 / 非紧凑三种布局共用
- 状态轨置于 `mmFoot` 之前，紧凑态顶部分隔线与炭黑 inset 失败区
- 非紧凑布局增加「参考素材与工具 / 提示词 / 输出与生成」分区标签
- Popover 第三段增加「时长与水印」标题

## 4) 非目标（本轮不做）

- 执行器 `assetId` 纵轴迁移（见 P2 另一条，需单独里程碑）
- 视频 API 真实轮询 / 新 Provider
- 底部 Dock 或 Inspector 挂载变更

## 5) 验收步骤

1. 画布选中视频节点，打开底栏 Portal：校验失败时，参数栏**上方**出现红色提示，底栏仍可改模型/画幅。
2. 点击生成：进度条出现在参数栏上方，不遮挡提示词区。
3. 模拟失败（断网或无效 key）：失败面板含「重试」与错误文案，重试按钮可点。
4. 生成成功：成功条 +「查看」打开节点最大化（有 `videoNodeId` 时）。
5. 展开面板 / Popover：输出设置中见「比例 / 清晰度 / 时长与水印」三组标题。

## 6) UI/UX

- **关键界面**：`VideoMultimodalInputPanel`（`layout=portal|expanded`）、`VideoOutputSettingsPopover`
- **关键状态**：校验 block、进度、成功 banner、失败 panel（`role=alert`）
- **键盘与焦点**：无新增快捷键；重试/查看为常规按钮
- **本轮 UI 非目标**：不改工作流 Tab 与参考缩略图交互

## 7) 风险与回退

- **风险**：状态轨占位导致紧凑面板变高
- **触发**：Portal 底栏被挤出节点可视区或状态重复显示两处
- **回退**：还原 `VideoMultimodalInputPanel` 内联状态块，删除 `VideoGenerationStatusRail.tsx`

## 8) 完成定义

- 上述验收 1～5 通过
- `npm run typecheck` + `npm run test` 通过
