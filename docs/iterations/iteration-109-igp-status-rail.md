# 迭代 109 — 图片面板统一状态轨

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-29**  
> 状态：**✅ 已完成**  
> 路线图：[iter-106～110 P0](./iteration-106-110-igp-p0-roadmap.md)  
> 真源：`VideoGenerationStatusRail.tsx`、iter-101 错误人话化

## 1) 本轮目标（一句话）

用 **单行可扫读的状态轨** 替代图片面板散落的 `igp-feedback` 块，统一展示 **校验失败、blockReason、任务失败、可重试**（对齐视频 `VideoGenerationStatusRail` 心智）。

## 2) 变更范围（最多 3 个模块）

- 新建 `ImageGenerationStatusRail.tsx`（或抽取 neutral `GenPanelStatusRail` + 图片 adapter）
- `ImageGenerationPanel.tsx`（移除/收敛 inline `igp-feedback`；接入 rail + 与生成钮 disable 联动）
- `lib/imageGeneration/` 错误文案映射（仿 `formatVideoGenErrorLine`，图片 API 错误码）

## 3) 功能清单（2～4 项）

- **校验态**：`ctx.blockReason`、模型未配置、prompt 空等 → 状态轨 1 行人话 + 生成钮 disable（取代面板中部 alert 块）
- **失败态**：`runNodeTaskAgent` 失败后 → 人话摘要 + **重试** 动作（调用现有 `handleGenerate`）；技术详情折叠（可选 P1，本轮至少不暴露 logid/mock）
- **warn 收敛**：`ctx.warnMessage` 进状态轨 info _tone，不占 prompt 与底栏之间额外垂直空间
- **与底栏 CTA 一致**：失败时主钮文案可见「重试」（对齐 iter-101 P0-3）

## 4) 非目标（本轮不做）

- 参考条 / @ pill / Tab（iter-106～108）
- 生成中居中胶囊（iter-110）
- Dreamina recover、Seedance 合规 pending（视频专用逻辑不硬套）
- Rust 侧新错误码（仅前端映射已有错误）

## 5) 验收步骤（3～5 步）

1. 未配置图片 API Key → 状态轨提示配置引导，生成钮 disabled，**无**中部红色大块 feedback。
2. 上游 block（如无有效 prompt + 无 ref）→ 状态轨 1 行说明原因，可扫读。
3. 模拟生成失败 → 状态轨人话 + 「重试」；点击重试再次触发 agent；**默认不显示**原始 stack/logid。
4. 仅有 warn（如 ref 分辨率提示）→ 状态轨 warn 色单行，面板布局不跳动。
5. `npm run test -- ImageGenerationStatusRail` + `typecheck` 通过。

## 6) UI/UX

- **关键界面**：状态轨位于 prompt 与底栏之间（对齐 VGP `VideoGenerationStatusRail` 位置）
- **关键状态**：idle / validation / warn / error / retry；与 `isGenerating` 互斥展示规则明确
- **键盘与焦点**：重试钮可 Tab 聚焦；Esc 不收起面板
- **本轮 UI 非目标**：不改状态轨视觉 token（复用 VGP 或 IGP scoped 同款）

## 7) 风险与回退

- **主要风险**：与 `igp-feedback`  duplicate；错误映射漏码仍露技术原文
- **触发条件**：失败无重试；block 与 warn 同时出现占两行以上
- **回退动作**：恢复 `igp-feedback--block/warn` div
- **回退后保留**：失败 API 响应样例

## 8) 完成定义（DoD）

- 验收 1～5 通过
- 图片面板无独立 `role=alert` 大块（除 aria-live 状态轨）
