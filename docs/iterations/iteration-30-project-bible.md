# 迭代 30 — 项目圣经 v1 + 角色参考绑定

**层**：AssetAndQualityLayer + ProductionFlowLayer  
**核心目标**：工程级 `.canvasflow/bible.json` 记录梗概/视觉风格/角色库；批量出图按镜头自动合并角色参考图。

## 模块

1. `src/lib/projectBible/` — 类型、读写、角色参考解析  
2. `src/store/projectBibleStore.ts` + `HermesBibleStrip`  
3. `batchGenerateImagesForStoryboard` — `resolveBeatReferencePaths`

## 功能点

1. 圣经持久化：`.canvasflow/bible.json`（logline、visualStyle、characters[]）  
2. Hermes 侧栏编辑 +「从镜头表同步角色」  
3. 出图：Hermes / 工作台 / 自动建链 均按镜合并 `角色图` + 圣经默认参考  
4. Situation / LLM 规划注入圣经摘要行

## 非目标

- `bible.update` Director 工具（后续迭代）  
- 圣经与 LLM 自动写回角色描述  
- 视频生成角色参考（仅图生图 batch）

## 手工验收

1. 镜头表第 1 镜上传「小明」角色图 → 同步圣经 → 显示 1 角色 1 参考图  
2. Hermes「帮我把分镜出图」→ 提交任务为图生图且 reference 含该路径（看节点/日志）  
3. 圣经填写视觉风格 → 对话/规划上下文含该行  
4. 保存工程后重开 → 圣经字段仍在

## 回滚

- 移除 `resolveBeatReferencePaths` 与 `HermesBibleStrip`，恢复仅 Hermes @素材 前缀
