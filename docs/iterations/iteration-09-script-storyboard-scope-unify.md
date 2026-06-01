# 第 9 轮执行单：统一「生成分镜」勾选范围（script-09-0A）

> **状态**：已完成（2026-05-21）  
> **依据**：[脚本节点开发顺序.md](../product/脚本节点开发顺序.md) 阶段 0-A  
> **功能真源**：[脚本节点功能说明.md](../product/脚本节点功能说明.md) §3.3

## 1) 本轮目标（一句话）

画布顶栏、全屏顶栏、侧栏「为勾选生成分镜」共用同一套 **「有有效勾选 → 仅勾选；否则 → 全部」** 规则。

## 2) 变更范围

- `src/lib/scriptStoryboardScope.ts`（新建）+ 单测
- `ScriptPreviewToolbar.tsx`（画布顶栏）
- `ScriptNodeFullscreenOverlay.tsx`（全屏顶栏）
- `ScriptStoryboardSection.tsx`（侧栏勾选按钮，逻辑抽取）

## 3) 功能清单

- [x] `resolveStoryboardBeatScope(beats, scriptBeatSelection)` 统一解析
- [x] 画布顶栏「生成分镜」按勾选范围生成；按钮文案 `生成分镜（N）` / tooltip 说明
- [x] 全屏 / 侧栏勾选路径改用同一 helper
- [x] 侧栏「为全部脚本生成分镜」保持显式全部（不变）

## 4) 非目标

- 草案 vs 解析文案 → 见 `iteration-09-script-labels-provider.md`（script-09-0B，已完成）
- Provider 路由 → 同上
- 分镜 Agent / `storyboardShots` 结构

## 5) 验收步骤

1. 脚本节点 ≥3 条镜头，**不勾选** → 画布顶栏「生成分镜」→ 应为全部镜头请求（状态栏/条数可感知）。
2. **勾选 2 条** → 画布顶栏显示「生成分镜（2）」→ 仅这 2 条有分镜文案更新。
3. 全屏内勾选 1 条 → 顶栏「生成分镜」→ 仅 1 条；与画布顶栏结果一致。
4. Inspector「为勾选脚本生成分镜」与画布顶栏勾选 2 条时行为一致。
5. Inspector「为全部脚本生成分镜」仍为全部（与上项对比）。
6. 勾选 id 已删除的镜头后点生成分镜 → 提示「所选镜头已不存在，请重新勾选」。

## 6) UI/UX

- **顶栏**：有勾选时按钮文案带数量；`title` 为完整说明。
- **侧栏**：保留两个显式按钮，降低学习成本。

## 7) 风险与回退

- **风险**：用户习惯顶栏「始终全部」。
- **回退**：删除 `scriptStoryboardScope.ts`，恢复顶栏 `targetBeats: rows`。

## Lib 对齐

本轮不涉及 Lib 新章节；属本地体验债清理。
