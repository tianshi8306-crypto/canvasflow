# 迭代 100 — R5 视频面板架构收敛与高级能力

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-29**  
> 总览：[`VIDEO_PANEL_LIBTV_OPTIMIZATION.md`](../product/VIDEO_PANEL_LIBTV_OPTIMIZATION.md)  
> 前置：建议 iter-98/99 至少完成其一

## 1) 本轮目标（一句话）

**合并 Chrome/Legacy 参数 UI**，接入 **生成取消** 与 **模型能力摘要**，并补齐 **Inspector 只读摘要** 与 **noSubtitles** 面板联动。

## 2) 变更范围（最多 3 个模块）

- `VideoMultimodalInputPanel.tsx`（删除 legacy `mmGenSettings*` 分支，统一 foot）
- `VideoModelPicker.tsx` + `videoGeneration/catalog.ts`（capability、`supportedWorkflows`）
- `useVideoNodeGeneration.ts` + `VideoGenerationStatusRail`（cancel）；`Inspector.tsx`（视频只读摘要）

## 3) 功能清单

- **单轨参数 UI**：仅保留 `VideoOutputSettingsContent` + compact foot；删除 legacy `<select>` / 内联三个 `mmParam`
- **生成取消**：生成中底栏钮为「停止」，调用 `cancelVideoJobViaBridge`；对齐图片 `IgpGenerateButtonIcon`
- **模型能力摘要**：Picker 每项副标题（时长范围、分辨率、工作流）；disabled + tooltip「未配置 Key」
- **参数与 catalog 联动**：非法分辨率/时长 grey out 或 clamp + toast；移除或隐藏 Seedance 不支持的 480P
- **Inspector 只读摘要**：`Seedance 2.0 · 9:16 · 5s · 有音频` + 链接「在画布编辑」
- **noSubtitles**：Popover 开关，与顶栏「智能去字幕」workflow 状态同步
- **角色库 stub**：未完成前隐藏按钮或移入「Labs」，避免占位挫败感

## 4) 非目标（本轮不做）

- 主体库 / 蓝色盾牌完整实现
- 文本节点 TTV 复用 VGP（见 `text-node-chrome-optimization.md` 独立迭代）
- 多帧 3×4 hover 网格
- 底部 Dock、新视频 Provider

## 5) 验收步骤

1. 代码库无 `layout` 分支下的 legacy `mmGenSettings` 渲染路径（仅 compact + expanded Modal）。
2. 生成中点击停止 → job cancelled，状态轨显示已取消，可再次生成。
3. 设置未配 Key 的模型在 Picker 中 disabled，hover 见配置引导文案。
4. Inspector 选中视频节点见参数摘要，与底栏 draft 一致。
5. 顶栏去字幕后 Popover「去字幕」为开；关闭后 draft 同步。
6. 参考区无「角色库」占位钮（或仅在 Labs 入口）。
7. `npm run typecheck` + `npm run test` 通过。

## 6) UI/UX

- **关键界面**：底栏 foot、VideoModelPicker、Inspector 视频段
- **关键状态**：generating → stopping → cancelled；模型 disabled + tooltip
- **键盘与焦点**：停止钮可键盘触发；Inspector 摘要只读
- **本轮 UI 非目标**：不改 iter-98 Focus Preview；不改 Tab 逻辑（iter-99）

## 7) 风险与回退

- **风险**：删除 legacy 路径后若有隐藏入口依赖 non-chrome 布局会断裂
- **触发**：cancel 后 activeJob 残留；catalog clamp 与已有工程 draft 不兼容
- **回退**：恢复 legacy 分支；移除 cancel 接线

## 8) 完成定义

- 验收 1～7 通过
- `VIDEO_PANEL_LIBTV_OPTIMIZATION.md` 问题 P2-1、P1-4、P1-7、P2-2、P2-5 标记为已 addressing
