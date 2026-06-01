# 迭代 32 — 剧本上传解析 + 漏洞报告

**层**：ProductionFlowLayer + AssetAndQualityLayer  
**核心目标**：桌面端选择 `.txt` / `.md` / `.docx`，提取正文、展示断点/漏洞报告，导入脚本节点并可选 AI 解析进 `scriptBeats`。

## 模块

1. `src-tauri` — `extract_script_document`（txt/md + docx zip 解压）  
2. `src/lib/scriptDocument/` — 漏洞分析 + 导入写回  
3. `ScriptDocumentImportDialog` — 脚本底栏 / 顶栏 / 全屏 / Hermes

## 功能点

1. Tauri 读取 docx（`word/document.xml`）与 utf-8 文本  
2. `analyzeScriptDocument`：过短/过长截断、场次标记、对白提示、空行比例  
3. 导入策略：有上游文本 → 写入文本节点 + 底栏解析要求；否则写入底栏全文  
4. 「导入并解析」复用 `runNodeSubgraph` / 脚本 Agent 与现有 `script_parse` 链路

## 非目标

- PDF / Fountain / Final Draft  
- 不经过 LLM 的纯规则拆镜  
- Hermes Director 专用 `script.import` 工具（后续可加）

## 手工验收

1. 准备 `.docx` 剧本 → 脚本节点底栏「上传剧本」→ 弹出漏洞报告  
2. 点「导入并解析」→ `scriptBeats` 出现多行镜头  
3. 文本节点已连脚本 → 导入后正文在上游文本，底栏为解析要求  
4. Hermes 侧栏（有脚本节点时）同样可上传

## 回滚

- 移除 `extract_script_document` 与 UI 按钮，保留上游文本粘贴流程
