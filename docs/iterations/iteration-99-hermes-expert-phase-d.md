# iter-99 · Hermes 专家路线阶段 D

**层级**：ProductionFlowLayer（L2 记忆 + L1 Skills 匹配）  
**前置**：iter-98（阶段 A/C）

## 1) 本轮目标

恢复/重试成功后写入工程记忆；按工程画像（单镜/短剧/广告/自由编排）提升 Skills 匹配。

## 2) 变更范围

- `hermesProactiveRecoveryMemory.ts`、`hermesProjectProfile.ts`
- `hermesJobReflection.ts`（恢复成功不再跳过复盘）
- `hermesSkillMetadata` / `hermesSkillMatching` / `hermesDirector` finalize
- `hermesOrbProactiveAct`（计划打标 `proactiveRecovery` + `orbSuggestionId`）

## 3) 功能清单

1. 成功执行恢复向计划（`video.retry_failed`、灵体主动恢复等）→ 写入 `[recover:…]` 记忆事实。
2. 灵体/用户点气泡执行 → 计划带 `proactiveRecovery` + `orbSuggestionId`，子修复计划继承。
3. LLM 制片摘要含 `【工程画像】`；Skill 排序对匹配画像 +8 分。
4. 侧栏进度：「已记录本次恢复成功经验…」
5. 用户说「重试失败视频」且 memory 含 `[recover:video_failed]` → 学习适应层注入恢复经验，弱计划替换为 `video.retry_failed`。

## 4) 非目标

- 自动新建用户 Skill 文件（仍由多步成功 `shouldWriteAutoSkill` 触发）
- 按项目类型切换不同系统 prompt

## 5) 验收

1. 开启灵体自动恢复 → 视频失败 → 自动重试成功 → `.canvasflow/hermes/memory.json` 出现 `[recover:video_failed]`。
2. 8 镜工程对话「搭短剧流程」→ 优先命中 `short-drama` Skill。
3. `npm run test -- hermesProjectProfile hermesProactiveRecoveryMemory`

## 6) 回退

移除 `writeRecoverySuccessMemory` 调用与 `projectType` Skill 加权。
