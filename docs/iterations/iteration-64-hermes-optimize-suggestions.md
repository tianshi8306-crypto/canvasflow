# Iteration 64 — E4 优化建议（主动补全）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.3 E4 · P2

## 1) 目标

在 I3 主动补全链路中，增加顾问向的节奏/镜数/提示词优化芯片（只给建议话术，不自动改稿）。

## 2) 范围

- `hermesProactiveSuggestions.ts` — 新增 E4 规则
- 与 iter-57 Orb / 侧栏芯片同源

## 3) 规则

| id | 条件 | 建议 |
|----|------|------|
| `optimize_shot_count` | ≥18 镜 | 顾问精简节奏（勿直接改） |
| `optimize_video_prompts` | ≥6 镜分镜+关键帧就绪、未出视频 | 检查运动/视频提示词 |

## 4) 非目标

- 自动 patch 分镜
- 独立顾问面板

## 5) 验收

1. 20 镜工程侧栏出现「顾问精简」芯片
2. 关键帧齐、未出视频时出现「检查提示词」
3. 单测 `optimize_shot_count` 通过

## 6) 状态

✅ 已实现（iter-64 / P2-E4）
