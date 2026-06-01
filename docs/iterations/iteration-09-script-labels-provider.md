# 第 9 轮执行单：草案/解析文案 + Provider 一致（script-09-0B）

> **状态**：已完成（2026-05-21）  
> **依据**：[脚本节点开发顺序.md](../product/脚本节点开发顺序.md) 阶段 0-B  
> **功能真源**：[脚本节点功能说明.md](../product/脚本节点功能说明.md) §3.1–3.2

## 1) 本轮目标（一句话）

用户能区分 **快速草案（本地模板）** 与 **AI 解析镜头**；解析/分镜/重新解析使用节点底栏所选 Provider，并在 Tauri 下解析前校验 API Key。

## 2) 变更范围

- `src/lib/scriptNodeActionLabels.ts`（文案常量）
- `src/lib/scriptNodeLlmParams.ts` + 单测
- `ScriptWorkbenchPrimaryActions`、`scriptWorkbenchAgent`、`dagnodeDispatchAgents`
- `ScriptComposerPanel`、`ScriptPreviewToolbar`、`ScriptNodeFullscreenOverlay`
- `ScriptStoryboardSection`、`scriptStoryboardAgent`
- `src-tauri`：`llm_complete_text` 增加 `provider_id` / `model`；`script_parse_request` 日志

## 3) 功能清单

- [x] 工作台「快速草案（本地模板）」与完成提示（不调 LLM）
- [x] 底栏 / 顶栏 / 全屏：「AI 解析镜头」「重新解析」；解析前 `preflightScriptNodeLlm`
- [x] 分镜生成传入 `llmParams`（`scriptNodeLlmInvokeParams`）
- [x] `llm_complete_text` Rust 参数与分镜 Agent 对齐

## 4) 非目标

- 生成分镜勾选规则（script-09-0A，已完成）
- 入口收敛、解析反馈（阶段 1）

## 5) 验收步骤

1. 工作台点「快速草案」→ 瞬时 3 条，状态栏提示未调用 AI。
2. 底栏选非默认 Provider →「AI 解析镜头」→ DAG 完成；`.canvasflow/runs.db` 或日志可见对应 `providerId`。
3. 有镜头时顶栏显示「重新解析」；无主题时禁用。
4. 全屏浮动条「重新解析」与顶栏行为一致。
5. 换 Provider 后「生成分镜」→ `llm_complete_text` 使用同一 Provider（日志/运行记录可核对）。

## 6) UI/UX

- 草案按钮带 `title` 说明本地模板。
- 解析相关按钮 tooltip 注明「使用底栏所选模型」。

## 7) 风险与回退

- **风险**：用户误以为「快速草案」会调 AI。
- **回退**：恢复旧按钮文案；移除 `preflightScriptNodeLlm` 与 `llmParams` 传参。

## Lib 对齐

与 LibTV「脚本 → 分镜」链路一致；草案为本地占位，解析走 DAG + LLM。
