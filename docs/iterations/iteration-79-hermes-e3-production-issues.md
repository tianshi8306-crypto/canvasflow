# Iteration 79 — E3 制片断链检测与修复增强

## 目标

规则检测矛盾/断链（缺分镜先出图、视频失败等），贯通 Situation、Loop 恢复与失败提示。

## 模块

- `hermesProductionIssues.ts`
- `hermesWorkflowRepair` / `hermesAgentLoop` / `hermesSituation`

## 验收

1. 有失败分镜时执行出图 → 自动插入补分镜
2. Situation 待办出现 `production_*` 类缺口
3. `npm run test -- hermesProductionIssues hermesAgentLoop` 通过

## 状态

✅ iter-79
