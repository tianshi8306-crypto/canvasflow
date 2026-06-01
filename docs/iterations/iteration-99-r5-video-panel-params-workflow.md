# 迭代 99 — R5 视频面板工作流与参数可用性

> 层：**CanvasExperienceLayer**  
> 对齐：LibTV 1.2.4 创作模式 Tab、底栏参数、再生成  
> 更新：**2026-05-29**  
> 总览：[`VIDEO_PANEL_LIBTV_OPTIMIZATION.md`](../product/VIDEO_PANEL_LIBTV_OPTIMIZATION.md)  
> 前置：可与 iter-98 并行；不依赖 iter-98 合并

## 1) 本轮目标（一句话）

修复 **工作流推断与 Tab 语义**，补齐 **输出参数可见性**，并实现 **有成片后精简底栏常驻** + **成功后再生成**。

## 2) 变更范围（最多 3 个模块）

- `useVideoIncomingReferenceItems.ts`（`detectWorkflow` 规则、首尾帧标注数据）
- `VideoMultimodalInputPanel.tsx` + `VideoOutputSettingsContent.tsx`（Tab 锁定、参数 foot、校验时序）
- `MinimalVideoNode.tsx` + `canvas-node-chrome-spec.md`（`showGenPanel` 策略）

## 3) 功能清单

- **`detectWorkflow` 对齐 Tab**：1 图无音视频 → `image_to_video`；2 图 → `first_last_frame`；3+ 图 → `image_reference` 或 `multimodal_reference`（产品定一条）；Tab 与推断一致
- **Tab 可锁定**：用户点击 Tab → `workflowLocked`；锁定后连线变化不覆盖；未锁定时仍自动推断；inactive Tab 可点
- **有成片常驻精简底栏**：`showGenPanel` 改为选中即显示 **compact 参数条**（模型 + 比例/时长 pill + 生成），或 `hasPath && !expandedModal` 仍显示；顶栏补「生成参数」Chip → pin 底栏
- **底栏高频参数**：比例 + 时长（或比例·分辨率）底栏可见；水印/智能时长/generateAudio 进 Popover「更多」
- **expose generateAudio**：Popover 增加「生成音频」开关，写回 `draft.output.generateAudio`
- **校验不受成功态 suppress**：改参考后非法 → 状态轨/inline 即时提示，即使曾生成成功
- **成功 CTA**：按钮文案/图标改为「再生成」；校验通过时始终可点
- **首尾帧 badge**：2 图模式参考条显示「首帧」「尾帧」+「交换首尾」（改 edge 顺序或 draft 序）

## 4) 非目标（本轮不做）

- Focus Preview / 缩略图 pill（iter-98）
- 生成中 cancel（iter-100）
- 合并 Chrome/Legacy 全删（iter-100）
- Inspector 完整同步、模型 catalog capability 联动
- `noSubtitles` 面板开关（可跟顶栏 subtitle workflow 单独立项）

## 5) 验收步骤

1. 连 1 张图：Tab 亮 **图生视频**（非全能参考）；连 2 张图：亮 **首尾帧**，条上见首帧/尾帧 badge。
2. 手动点 Tab「文生视频」并锁定：再连参考图，Tab 不变，直至用户解锁。
3. 节点已有成片：单选后 **底栏精简条仍可见**，可直接改 prompt/模型并再生成，无需先钉住。
4. Popover「更多」中切换「生成音频」→ 再次生成请求含 `generate_audio: false/true`（日志或 mock 断言）。
5. 生成成功后删一条必选参考：立即出现校验错误，生成钮 disable，**无需先点生成**。
6. 成功态生成钮显示「再生成」且可点击（校验通过时）。
7. `npm run test -- useVideoIncomingReferenceItems videoPanelLibtvSections` 通过。

## 6) UI/UX

- **关键界面**：Portal 底栏、Tab 栏、输出 Popover、首尾帧参考条
- **关键状态**：Tab locked / auto；hasPath + 精简底栏；校验 block 与成功 banner 共存
- **键盘与焦点**：Tab 可键盘聚焦切换（Arrow + Enter）；与全局 Esc 不冲突
- **本轮 UI 非目标**：不改 `@` pill 形态（iter-98）；不做 480P 动态 grey out

## 7) 风险与回退

- **风险**：常驻底栏 + 顶栏工具同时存在，垂直空间更紧；与图片节点 `showGenPanel` 规范不一致需更新 spec
- **触发**：有成片时底栏遮挡时间线/邻节点；workflow 锁定与 Hermes 批量写 workflow 冲突
- **回退**：恢复 `showGenPanel` 原逻辑；Tab 恢复只读；`detectWorkflow` 回退 git 版本

## 8) 完成定义

- 验收 1～7 通过
- 更新 `canvas-node-chrome-spec.md` §6.11 视频底栏显隐与 Tab 可锁定说明
