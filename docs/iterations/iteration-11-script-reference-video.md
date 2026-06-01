# 迭代 11-2B：参考视频输入可发现

**层**：CanvasExperienceLayer + ProviderOrchestrationLayer  
**核心目标**：用户知道「连 videoNode ≠ 真看视频」，但工程内路径会进入脚本解析。

## 功能点

1. 壳 float + Inspector 提示「已连接 N 个参考视频」及路径/定位
2. 底栏「参考视频说明」一键插入 `【参考视频】` 模板块
3. `script_parse_request` 事件增加 `referenceVideoPaths`（保留 `videoRefCount`）

## 模块

| 模块 | 文件 |
|------|------|
| 参考视频聚合 | `src/lib/scriptReferenceVideo.ts` |
| UI | `ScriptReferenceVideoBanner.tsx`、`ScriptNodeReferenceVideoFloat.tsx` |
| 集成 | `MinimalScriptNode`、`ScriptComposerPanel`、`Inspector`、`RunPanel` |
| 后端日志 | `src-tauri/src/executor/script_node.rs` |

## 非目标

- 视频抽帧、多模态「看视频」
- txt/文件导入剧本（见 11-2A 上游文本）

## 手动验收

1. 画布：视频节点导入 `assets/…` 并连线脚本节点 → 节点上方出现「参考视频 · N」
2. Inspector：同场景显示路径列表与「定位」
3. 底栏：点击「参考视频说明」→ prompt 含 `【参考视频】` 与路径行
4. 仅连 video、底栏写解析要求、无文本节点 → AI 解析可跑
5. 运行记录 → 开发者详情 → `script_parse_request` 展示 `reference_video_paths`

## 回滚

- 删除 `scriptReferenceVideo*` 与 Banner；恢复 `script_parse_request` 仅 `videoRefCount`
