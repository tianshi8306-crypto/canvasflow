# 视频节点生成参数面板 — LibTV 对齐分析与优化路线图

> **版本**：1.0  
> **日期**：2026-05-29  
> **对齐章节**：LibTV 1.2.4 视频节点、4.x 视频主体库、5.x 模型清单  
> **形态约束**：不采用 LibTV 底部 Dock；节点外浮层 Portal + 展开 Modal（见 [`LIBTV_GUIDE_ALIGNMENT.md`](./LIBTV_GUIDE_ALIGNMENT.md)）  
> **代码真源**：`VideoMultimodalInputPanel.tsx`、`VideoPromptMentionInput.tsx`、`MinimalVideoNode.tsx`、`useVideoIncomingReferenceItems.ts`

---

## 1. 一句话结论

CanvasFlow 视频面板在 **Chrome 分层、状态轨、LibTV 式 Tab 分组、@ 引用浮层** 上已有基础，但 LibTV 1.2.4 的核心体验是 **「看参考 → @ 引用 → 写 prompt → 调参 → 再生成」零上下文切换的闭环**；当前实现把 **成片预览（节点壳）** 与 **参考预览 / prompt 输入（底栏 Portal）** 拆断，且参数层存在 **工作流语义断裂、输出参数折叠过度、有成片后面板消失** 等问题。

优化应分四阶段：**A 参考–提示词交互闭环 → B 工作流与参数可用性 → C 架构收敛 → D 视觉对齐与错误可扫读**。

---

## 2. LibTV 交互模型（参考图归纳）

LibTV 视频生成器是 **垂直多模态编辑器**，固定三层 + 底栏：

```text
┌─ 大预览（选中参考 / 成片 · 0:15 · 截图 · 展开） ─┐
├─ 参考素材横条（编号缩略图 · hover × 删除 · 盾牌） ─┤
├─ 提示词（缩略图 pill + 长文 · @ 触发列表） ────────┤
└─ 底栏：模型 · 比例 · 时长 · 音频 · 生成 ──────────┘
```

四条交互闭环：

| 闭环 | LibTV 行为 |
|------|-----------|
| **看** | hover/选中参考条 → 上方大预览切换 |
| **引** | 输入 `@` → 列表选素材 → prompt 内变为「缩略图 + 图片N」pill |
| **证** | prompt chip **蓝勾** = 上游图经 Seedance 2.0 **自动合规**；**主体库盾牌** = 本地/云端主体资产；与「是否已 @」区分 |
| **写** | 参考条序号与 `@N` / pill 一一对应 |

顶栏 **标记 / 运镜 / 角色库** 是参考素材的元操作，不是与 prompt 平行的第四块。

---

## 3. CanvasFlow 现状架构

```text
节点壳（成片预览 + 顶栏工具）
        ↕ 物理分离
底栏 Portal：Tab → [标记|运镜|角色库] + 参考条 → 提示词 → 状态轨 → 底栏参数
```

| 模块 | 现状 | LibTV 对照 |
|------|------|-----------|
| 创作模式 Tab | 6 个，只读，连线推断 | 可切换 Tab |
| 参考条 | 横滑、角标、hover 小图、单击插 `@` | 主导航 + 大预览 |
| `@` 浮层 | 缩略图 + 标题 + `(@N)` + 已引用 ✓ | + hover 行级大图 |
| prompt pill | 纯文字 `@图片N` | 缩略图 + 标签 chip |
| 输出参数 | Chrome 态合并 pill + Popover | 高频参数底栏可见 |
| 有成片 | 底栏默认隐藏（需钉住/展开） | 生成器常驻 |

---

## 4. 问题清单（合并两轮分析）

### P0 — 主流程可用性

| # | 问题 | 证据 / 位置 |
|---|------|-------------|
| P0-1 | **有成片后面板默认消失**，改 prompt/模型/时长需钉住或顶栏展开 | iter-99 ✅ `showGenPanel` 常驻 |
| P0-2 | **Tab 展示 6 模式，推断只覆盖 4 种**；`image_to_video` / `image_reference` 永不亮起 | iter-99 ✅ `detectWorkflow()` |
| P0-3 | **Tab 只读**，无法像 LibTV 先选模式再连素材 | iter-99 ✅ `workflowLocked` |
| P0-4 | **`generateAudio` / `noSubtitles` 无 UI**，与 API / 顶栏 workflow 不同步 | iter-99/100 ✅ `VideoOutputSettingsContent` |
| P0-5 | **预览 ↔ 参考条闭环断裂** | iter-98 ✅ Focus Preview |
| P0-6 | **`@` 列表无 hover 大图** | iter-98 ✅ |
| P0-7 | **prompt pill 尺寸过大 / 合规蓝勾未与「已 @」分层** | iter-98 已有缩略图 pill；iter-101 轻量化 + 蓝勾语义 |
| P0-8 | **成功后校验被 suppress** | iter-99 ✅ |
| P0-9 | **API 错误原文暴露**（bridge/logid/1310） | iter-101 |

### P1 — 效率与理解

| # | 问题 |
|---|------|
| P1-1 | 输出参数全进 Popover | iter-99 ✅ 比例/时长外露 |
| P1-2 | 首尾帧无标注与交换 | iter-99 ✅ |
| P1-3 | 成功态缺「再生成」 | iter-99 ✅ |
| P1-4 | 模型 Picker 无能力摘要 / Key 未配置引导 | iter-100 ✅ |
| P1-5 | 参考条主手势 | iter-98 ✅ 单击预览 / Shift+@ |
| P1-6 | 参考区与 prompt 被分区标签挤压 | iter-101 弱化标题 |
| P1-7 | 生成中无取消 | iter-100 ✅ |
| P1-8 | **合规蓝勾 vs 已 @ vs 主体库盾牌** 语义混用 | iter-101 前置 ✅ 蓝勾+拦截；盾牌仍 P2 |
| P1-9 | 失选清 pin，多分镜切换丢上下文 |
| P1-10 | 顶栏 workflow 改 draft，面板无高亮 | iter-100 部分 ✅ noSubtitles |
| P1-11 | 底栏主 CTA 层级弱、音频态不可见 | iter-101 |

### P2 — Polish 与技术债

| # | 问题 |
|---|------|
| P2-1 | Chrome / Legacy 双轨参数 UI | iter-100 ✅ 单轨 |
| P2-2 | Inspector 仅 prompt，与底栏参数分裂 | iter-100 ✅ 只读摘要 |
| P2-3 | UI 480P vs 知识库 720P/1080P；`auto` 比例无说明 |
| P2-4 | `video_edit` / `video_extend` 类型无 UI |
| P2-5 | 角色库 stub 破坏专业感 | iter-100 ✅ 已隐藏 |
| P2-6 | 文本节点 TTV 未复用 `VideoMultimodalInputPanel` |
| P2-7 | picker 显示 `(@N)` 但插入 `@图片N`，显示与写入不一致 |
| P2-8 | 多帧/宫格 hover 网格预览（分镜组）未做 |

---

## 5. 目标态信息架构（Portal 约束下翻译 LibTV）

```text
┌─ [展开/钉住时] Reference Focus Preview（参考态大预览） ─┐
├─ 参考条（hover/click → 上图；默认主导航） ──────────────┤
├─ Prompt（缩略图 pill + 文本 · @ 浮层 hover 大图） ────────┤
├─ [细] 校验/进度（不占 prompt 高度） ─────────────────────┤
└─ 模型 · 比例 · 时长 · [更多] · 生成（再生成） ───────────┘

节点壳 = 成片输出预览（hasPath 时）
底栏   = 输入态多模态编辑（有成片时也保留精简条）
```

**两种预览分工**：节点壳 = 输出；面板顶 = 写 prompt 时的参考 Focus。

---

## 6. 优化路线图（四阶段）

| 阶段 | 迭代文档 | 层 | 核心目标 | 模块（≤3） |
|------|----------|-----|----------|-----------|
| **A** | [`iteration-98-r5-libtv-ref-prompt-loop.md`](../iterations/iteration-98-r5-libtv-ref-prompt-loop.md) | CanvasExperience | LibTV 参考–prompt 交互闭环 | `VideoMultimodalInputPanel`、 `VideoPromptMentionInput`、`VideoPromptAtPicker.css` |
| **B** | [`iteration-99-r5-video-panel-params-workflow.md`](../iterations/iteration-99-r5-video-panel-params-workflow.md) | CanvasExperience | 工作流语义 + 参数可用性 + 有成片常驻 | `useVideoIncomingReferenceItems`、`VideoMultimodalInputPanel`、`MinimalVideoNode` |
| **C** | [`iteration-100-r5-video-panel-architecture.md`](../iterations/iteration-100-r5-video-panel-architecture.md) | CanvasExperience | 架构收敛 + 取消/Inspector/模型能力 | `VideoOutputSettingsContent`、`VideoModelPicker`、`useVideoNodeGeneration` |
| **D** | [`iteration-101-r5-video-panel-libtv-visual-parity.md`](../iterations/iteration-101-r5-video-panel-libtv-visual-parity.md) | CanvasExperience | LibTV 视觉对齐 + 错误可扫读 + 合规蓝勾语义 | `VideoGenerationStatusRail`、`VideoMultimodalInputPanel` foot、`seedanceImageCompliance` |

阶段间依赖：**A 可与 B 并行部分项**；C 依赖 B；**D 依赖 C**，且 **Seedance 合规蓝勾 + 生成前拦截**（`seedanceImageCompliance`）已作为 D 的前置落地，D 验收含回归。

---

## 7. LibTV 对齐 vs 不应对齐

| 对齐 | 不应对齐（已决策） |
|------|-------------------|
| 参考–prompt–预览闭环 | 底部 Dock 常驻 |
| Tab 可切换 / 工作流语义 | 云端会员/积分 |
| 缩略图 pill、@ 列表 hover 预览 | 合规素材库云端审核 |
| 高频参数底栏可见 | 逐 API 复刻 Lib 后台 |
| Seedance 2.0 **合规蓝勾**（自动校验，非已 @） | VIP / 积分 / 批量数 |
| 主体库 / 角色库（本地 assets MVP） | |

---

## 8. 相关文档

- [`LIBTV_GUIDE_ALIGNMENT.md`](./LIBTV_GUIDE_ALIGNMENT.md)
- [`canvas-node-chrome-spec.md`](../node-ui-spec/canvas-node-chrome-spec.md) §6.11
- [`video-node-chrome-phase2.md`](../design/video-node-chrome-phase2.md)
- [`seedance-params.md`](../hermes-knowledge/models/seedance-params.md)
- [`iteration-101-r5-video-panel-libtv-visual-parity.md`](../iterations/iteration-101-r5-video-panel-libtv-visual-parity.md)（合规蓝勾、错误人话化、底栏 CTA）
- iter-16 状态轨 · iter-86 Tab 分组

---

## 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-29 | 首版：合并参数分析 + LibTV 参考图交互分析 + 三阶段路线图 |
| 2026-05-29 | 阶段 D / iter-101；修正合规蓝勾语义；更新 P0/P1 与 iter-98～100 对齐状态 |
