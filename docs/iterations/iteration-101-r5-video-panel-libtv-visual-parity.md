# 迭代 101 — R5 视频面板 LibTV 视觉对齐与错误可扫读

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-29**  
> 总览：[`VIDEO_PANEL_LIBTV_OPTIMIZATION.md`](../product/VIDEO_PANEL_LIBTV_OPTIMIZATION.md)  
> 前置：iter-98～100；**Seedance 合规蓝勾 + 生成前拦截**（`seedanceImageCompliance` / `useSeedanceImageComplianceMap`）已落地，本轮验收含回归

## 1) 本轮目标（一句话）

在 **Portal 形态不变** 前提下，对齐 LibTV 的 **底栏主 CTA 层级、错误可扫读、参数条信息密度**，并厘清 **合规蓝勾 vs 已 @** 两套语义，避免用户把蓝勾当成引用确认。

## 2) 变更范围（最多 3 个模块）

- `VideoGenerationStatusRail.tsx` + `formatVideoGenErrorLine`（错误码映射、技术详情折叠）
- `VideoMultimodalInputPanel.tsx` + `MinimalVideoNode.css`（底栏 foot、生成钮、字数计数、分区标题）
- `videoPanelLibtvSections.ts` + `MentionInput.css`（Tab 顺序；prompt chip 尺寸）

## 3) 功能清单（P0 / P1）

### P0 — 主流程与信任感

| # | 项 | 说明 |
|---|-----|------|
| P0-1 | **错误人话化** | `ExceedConcurrencyLimit`（ret=1310）等映射为「当前生成并发已满，请稍后重试」；**不**向用户展示 `bridge 模式`、`mock`、`logid` |
| P0-2 | **技术详情折叠** | 状态轨默认 1～2 行人话 +「重试」；完整 API 原文进可展开「技术详情」 |
| P0-3 | **主生成 CTA 层级** | 底栏右侧 **大号主钮**（生成 / 停止 / 再生成 / 重试）；失败态 **可见「重试」文案**，非仅小图标 |
| P0-4 | **合规拦截回归** | 上游图 `fail` / `unknown` / `pending` 时生成钮 disable + 状态轨提示（复用已有 `validationResult` 合并逻辑） |

### P1 — 效率与 LibTV 密度

| # | 项 | 说明 |
|---|-----|------|
| P1-1 | **底栏参数组合 pill** | 主行展示 `9:16 · 720P · 15s`；**音频开/关**用扬声器图标可见（不必进「更多」才知状态）；比例/时长仍可点 pill 改 |
| P1-2 | **字数计数归位** | `1120/16000` 从 foot 挪到 **prompt 区右下角**，释放 CTA 空间 |
| P1-3 | **合规蓝勾 vs 已 @** | 蓝勾 = Seedance 2.0 **自动合规**（参考条 + prompt chip）；`isCited` 仅弱样式（描边/角标），**不得**复用 LibTV 蓝勾样式 |
| P1-4 | **prompt chip 轻量化** | 内联 pill 高度 ~24–28px，避免「大图塞进正文流」；大图仅 Focus Preview / hover |
| P1-5 | **Tab 顺序** | 向 LibTV 靠拢：`文生视频 · 全能参考 · 图生视频 · 首尾帧 · 图片参考`；`参考视频` 无连线时隐藏或收到次级 |
| P1-6 | **分区标题弱化** | compact 模式下收起或合并「参考」「提示词」小标题，纵向让给 prompt |

## 4) 非目标（本轮不做）

- 主体库 / 蓝色盾牌（云端合规素材库）
- VIP / 积分 / 批量数 / 翻译润色底栏图标（LibTV 云产品差异）
- 文本节点 TTV 复用 VGP、多帧 3×4 网格、底部 Dock
- Rust `video_gen_start` 二次硬校验（可后续 iter-102）
- 图片节点壳上独立合规标（本轮仅视频面板参考条 + chip）

## 5) 验收步骤

### P0

1. **并发限流文案**：模拟或真实触发 `ExceedConcurrencyLimit` / ret=1310 → 状态轨显示 **人话一句**（含「稍后重试」），**无** `logid`、`bridge`、`mock` 字样；展开「技术详情」才见原文。
2. **失败重试 CTA**：生成失败后底栏主钮 **可见「重试」文字** + 足够点击面积；点击仍走 `handleGenerate`（经校验）。
3. **不合规图拦截**：连一张超宽或 >30MB 图 → 参考条 **无蓝勾**（或红警告）；状态轨提示「参考 N 不符合 Seedance 2.0…」；生成钮 **禁用**；合规后恢复可点。
4. **合规中拦截**：刚打开工程、合规探测 `pending` 时 → 生成钮禁用，提示「校验中，请稍候」。

### P1

5. **底栏组合 pill**：主行可见 `比例 · 分辨率 · 时长` 与 **音频图标**；改音频后图标状态即时变化。
6. **字数位置**：字数在 prompt 输入框 **右下**，不在模型与生成钮之间。
7. **双语义不混淆**：某图已 @ 进 prompt 且合规通过 → 参考条可有 **弱 cited 样式** + **蓝勾** 同时存在；蓝勾 hover 为「Seedance 2.0 合规」，非「已引用」。
8. **chip 尺寸**：长 prompt 多 @ 时 pill 为 **小 chip**，正文可扫读，无整块插图撑行高。
9. **Tab 顺序**：与 LibTV 一致或文档说明差异；仅连参考视频时出现「参考视频」Tab。
10. `npm run test -- --run seedanceImageCompliance VideoGenerationStatusRail` 通过。

## 6) UI/UX

- **关键界面**：`VideoMultimodalInputPanel` foot、状态轨、prompt 区、创作模式 Tab
- **关键状态**：失败（人话 / 技术详情）、合规 pass/fail/pending、生成中停止、成功再生成
- **键盘与焦点**：主 CTA 可 Tab 聚焦；技术详情折叠不抢 textarea 焦点
- **本轮 UI 非目标**：不改 iter-98 Focus Preview 逻辑；不改 iter-99 workflow 锁定规则

## 7) 风险与回退

- **风险**：组合 pill 与 iter-99「比例/时长外露」冲突，需产品确认音频进主行、其余进「更多」
- **触发**：错误映射漏码仍露 logid；合规通过但 API 仍拒（需技术详情排查）
- **回退**：恢复三分 foot pill；恢复 `formatVideoGenErrorLine` 截断逻辑；合规拦截可从 `validationResult` 合并处移除

## 8) 完成定义

- P0 验收 1～4、P1 验收 5～10 全部通过
- [`VIDEO_PANEL_LIBTV_OPTIMIZATION.md`](../product/VIDEO_PANEL_LIBTV_OPTIMIZATION.md) 更新：**P0-7** 改为「chip 已有缩略图，差尺寸与合规蓝勾」；补充 **合规蓝勾 ≠ 已 @** 语义表
- 不在本文档范围内的 P2（`video_edit` UI、TTV 复用 VGP 等）不纳入 DoD

## 附录：Seedance 2.0 参考图合规（真源）

> LibTV prompt chip **蓝勾** = 上游图通过下列规则后的 **系统自动标**，非用户 @ 确认。

| 维度 | 规则 |
|------|------|
| 格式 | jpeg、png、webp、bmp、tiff、gif、heic/heif |
| 宽高比 宽/高 | 开区间 **(0.4, 2.5)** |
| 边长 | 闭区间 **300–6000 px** |
| 大小 | 单张 **< 30MB** |

代码真源：`src/lib/seedance/seedanceImageCompliance.ts`、`useSeedanceImageComplianceMap.ts`、`SeedanceComplianceBadge.tsx`。
