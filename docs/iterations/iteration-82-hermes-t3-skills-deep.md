# iter-82 · Hermes T3 Skills 深化

## 1) 本轮目标

Skill 从简单 id 匹配升级为触发词评分、分类目录、规划阶段模板联动。

## 2) 变更范围

- `hermesSkillMetadata.ts` / `hermesSkillMatching.ts` / `hermesSkillPlan.ts`
- `hermesSkillRegistry.ts`、`hermesDirector.ts`、`hermesAgentContext.ts`
- `hermesAgentChat.ts`（`use_skill` 意图）

## 3) 功能清单

- 内置 Skill 元数据：`triggers`、`category`、`templateId`、`priority`
- `rankSkillsForMessage` 评分排序，上下文注入带相关度
- `finalizeDirectorPlan` 中 `applySkillsToDirectorPlan`：弱计划/LLM 计划可套用 Skill 关联模板
- 用户 Skill frontmatter 扩展 + 分组目录展示
- 对话「使用 skill …」快速查看匹配正文

## 4) 非目标

- Skill 可视化编辑器
- 远程 Skill 市场

## 5) 验收步骤

1. 打开工程，对 Hermes 说「分镜出关键帧」，确认计划含 `storyboard-keyframes` 模板步骤
2. 说「有哪些 skills」，目录按分类展示
3. 说「使用 skill 短剧」，返回匹配 Skill 正文与模板 hint
4. `npm run test -- hermesSkillMatching`

## 6) UI/UX

本轮无 UI 变更（侧栏对话与计划文案行为增强）。

## 7) 风险与回退

- 风险：误匹配模板覆盖规则计划
- 回退：移除 `applySkillsToDirectorPlan` 调用或提高 `SKILL_TEMPLATE_OVERRIDE_MIN_SCORE`
