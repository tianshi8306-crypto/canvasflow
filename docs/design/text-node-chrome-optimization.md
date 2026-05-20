# 文本节点 Chrome 优化方案（对齐图片 / 视频节点）

> **版本**：1.2  
> **日期**：2026-05-20  
> **状态**：Chrome C1–C4 已实现（2026-05-20）  
> **状态机真源**：[`text-node-states-spec.md`](./text-node-states-spec.md)（S1–S7 + 显隐矩阵 + 附录对照表）；本文 §5.2 显隐表**已废止**，勿再按四 Chip / 顶栏文档组实现。  
> **产品决策（功能 3）**：素材库目标为 **工程级**（`assets/` + 运行库索引）；**全量**实现为正式范围；**现阶段仅 UI/数据占位**，不阻塞 Chrome C1–C4。  
> **产品确认（2026-05-20）**：认可 **P0 占位**（顶栏「素材库」Chip + 空面板；未开工程 disabled）；F3 P1–P3 按 §13 全量交付。  
> **基准规范**：`docs/node-ui-spec/canvas-node-chrome-spec.md`  
> **对照实现**：`MinimalImageNode` / `MinimalVideoNode` / 现行 `TextNode`  
> **迭代层**：CanvasExperienceLayer  

---

## 0. 产品功能定义与现状对照（2026-05-20 同步）

以下为产品侧归纳的 **四大能力**，以及 CanvasFlow **当前实现**、**缺口**与 **Chrome 优化方案中的落点**（不涉及新代码，仅对齐认知）。

### 功能 1：文本添加

**产品定义**：手动输入、复制文本；AI 生成文本（文案、剧本、字幕等）；依托外接模型 API 优化生成效果。

| 子能力 | 现状（`textNode`） | 说明 |
|--------|-------------------|------|
| 手动输入 | ✅ | 空态「自己编写」→ 壳内 `contentEditable`；有正文后双击编辑；`TextNodeExpandEditModal` 大窗编辑 |
| 复制 / 粘贴 | ✅ 部分 | 系统剪贴板：`TextNodePasteImportModal`（粘贴导入）、右键「复制到剪贴板」；画布 `Ctrl+C/V` 复制**整个节点** |
| 从脚本 / 上游写入 | ✅ | `scriptToText` 工作流 + `TextNodeScriptSyncPanel` 从 `scriptNode` 同步正文 |
| AI 生成写入正文 | ⚠️ 间接 | 底栏 Composer「发送」→ `dispatchTextNodeComposerRun` → DAG `runNodeSubgraph`；Rust 将 `textNode` 与 `llm` 同样走 `run_llm_node`（OpenAI 兼容 `chat/completions`），结果回写 `data.prompt` |
| 外接模型 API | ✅ | 设置页 `providers` + 节点 `params.providerId` / `model`；底栏可选 Provider（Tauri 下 `load_settings`） |
| 字幕 / 专用模板 | ❌ | 无「字幕」类型或专用模板；可用正文 + 下游节点消费 |
| 图生提示词 | ⚠️ 工作流 | 锚点 `imageToPrompt` 设 `textWorkflow`，空态占位；具体生成逻辑依赖下游图节点 / 连线，非文本节点内一键出稿 |

**数据字段**：`data.prompt` = 正文（画布记忆体）；`params.textModelInput` = 底栏「对模型说的话」（与正文可分离）。

---

### 功能 2：文本编辑

**产品定义**：字体、字号、颜色、对齐；换行、分段、层级；适配不同创作场景。

| 子能力 | 现状 | 说明 |
|--------|------|------|
| 换行 / 分段 | ✅ | `contentEditable` 自然换行；只读态 `pre-wrap` |
| 层级（标题 / 列表） | ✅ 基础 | `TextNodeFormatToolbar`：`H1–H3`、段落、粗体、斜体、有序/无序列表、分割线（`document.execCommand`） |
| 字体 / 字号 / 颜色 | ❌ | 未实现；存储为纯文本 `innerText`，无样式 runs |
| 对齐方式 | ❌ | 未实现 |
| 场景适配（字幕版式等） | ❌ | 无场景预设；视频字幕在视频/时间线侧，不在文本节点排版 |

**结论**：当前是 **轻量富文本（结构标记）**，不是设计软件级排版。若产品坚持功能 2 全量，需单独立项（富文本模型或 Markdown + 预览），**不宜**在 Chrome 迭代 C1–C4 中夹带。

---

### 功能 3：文本复用（**全量目标 · 工程级 · 现阶段占位**）

**产品定义**：常用文本（LOGO 标语、固定文案等）收藏；批量复制粘贴；跨项目调用；**工程内素材库**存储。

**产品决策（2026-05-20）**

| 项 | 结论 |
|----|------|
| 存储层级 | **工程级**：与图/视频一致，真源在工程目录 + `.canvasflow/runs.db` 素材索引 |
| 范围 | **功能 3 做全量**（收藏 / 浏览 / 插入 / 批量 / 跨项目），非长期只做 localStorage |
| 现阶段 | **仅占位**：入口可见、交互可点但提示「即将支持」或只读空列表；**不**在本阶段实现完整读写 |
| 与 Chrome 关系 | C1 顶栏预留「素材库」Chip；完整能力单独立项 **F3**（见 §13），晚于或并行 C2 |

| 子能力 | 现状 | 全量目标（F3） |
|--------|------|----------------|
| 收藏常用文本 | ⚠️ `localStorage` 临时实现 | 保存为 `assets/text-snippets/{id}.txt` + `upsert_asset(..., "text", ...)` |
| 从素材库插入 | ❌ 无 UI | 顶栏/底栏/图库 Tab 选用 → 写入 `prompt` 或追加 |
| 批量复制粘贴 | ⚠️ 仅节点级 | 多选文本节点 → 批量入库；素材库多选 → 批量插入新节点 |
| 跨项目 | ❌ | 打开他工程只读浏览；或导出 `.cfsnippet` 包再导入 |
| 工程素材库 | ❌ | 图库 `list_assets` 筛选 `media_type=text`；与工程打包/Git 一致 |

**结论**：现行 `textMaterialStorage` 视为 **技术债**，F3 上线后迁移并废弃浏览器本地库。详见 **§13 功能 3 全量规格**。

---

### 功能 4：文本生成

**产品定义**：自然语言需求或结构化提示词，由语言模型完成文本生成任务。

| 子能力 | 现状 | 说明 |
|--------|------|------|
| 自然语言输入 | ✅ | 底栏 Composer（`textModelInput`）+ 壳内正文（`prompt`）；发送时 **优先** `textModelInput`，否则 `prompt`（`textNodeDispatchAgentRuntime.sense`） |
| 结构化提示 | ⚠️ | Inspector「额外参数 JSON」可传 API 参数；**无**文本节点内 `/` 斜杠预设（图片底栏 `MentionInput` 已有，文本 Composer 仍为普通 textarea） |
| `@` 引用上游 | ❌（文本底栏） | 图/视频生成面板已支持；文本 Composer **未**接 `MentionInput` |
| 触发执行 | ✅ | Composer ↑ → Agent 归一化 → `runNodeSubgraph` → 后端 LLM → 回写 `prompt` |
| 与 DAG 关系 | ✅ | 文本节点可作为上游；`incoming_texts_ordered` 供下游 LLM/脚本等合并上下文 |
| 深度思考上限 | ✅ | 前端 `200000` 字截断（`DEEP_THINKING_MAX_INPUT_CHARS`） |

**相关节点**：纯对话式 **`llm` 节点**仍保留；`textNode` = 正文容器 + 生成底栏 + 多工作流（见下）。

---

### 工作流扩展（产品四大功能之外，但已实现）

通过锚点 / `params.textWorkflow` 与下游联动，不属于上述四条的「通用文本」但影响节点形态：

| `textWorkflow` | 作用 |
|----------------|------|
| `writeSelf` | 默认自己编写 |
| `textToVideo` | 底栏 `TextNodeTextToVideoPanel`，绑定 `videoNodeId` |
| `textToMusic` | 底栏音乐生成配置，绑定 `audioNodeId` |
| `scriptToText` | 从 `scriptNode` 同步正文 |
| `imageToPrompt` | 连图节点后的提示词工作流占位 |

---

### 四大功能 × Chrome 优化方案映射

| 产品功能 | 优化方案主要落点 | 仍须单独立项 |
|----------|------------------|--------------|
| **1 文本添加** | 空态浮动钮、顶栏粘贴/展开、脚本同步入顶栏 | 字幕模板、图生提示词一键闭环 |
| **2 文本编辑** | 格式操作迁 **顶栏**；壳内只读/编辑分区 | 字体/字号/颜色/对齐、场景版式 |
| **3 文本复用** | **现阶段**：顶栏「素材库」占位 Chip + 空面板 stub | **F3 全量**：§13（工程 `assets`、图库、批量、跨项目） |
| **4 文本生成** | Composer → `MentionInput` + Provider Picker + CTA 三态 + 进度 | 结构化模板库与文本节点深度整合 |

---

## 1. 背景与目标

### 1.1 为什么要做

文本节点已部分接入 Chrome（`NodeChromeShell`、外置标签/字数、`TextNodeBottomPortal`、`SimpleAnchors`），但与图片、视频节点相比，仍存在：

- **空间分层不统一**：排版条、下载钮嵌在壳内；图片/视频的「能力」多在顶/底 Portal。
- **显隐策略不完整**：无「有正文 + 顶栏 / 钉住底栏」组合；底栏仅在选中且非编辑时出现，逻辑分散。
- **工作流 UI 分叉**：`textToVideo` 使用独立的 `TextNodeTextToVideoPanel`，未复用 `VideoMultimodalInputPanel`，与视频节点底栏体验不一致。
- **控件世代混杂**：底栏仍用原生 `<select>`、内联 `btn`；视频已用 `VideoModelPicker`、pill、统一 CTA 三态。

### 1.2 优化目标（一句话）

在 **正文保留壳内可编辑** 的前提下，把文本节点的 **元信息、快捷操作、模型对话、工作流参数** 对齐图片/视频的 Chrome 分层与交互状态机，并收敛五种 `textWorkflow` 的入口与底栏形态。

### 1.3 非目标（本期方案不写实现）

- 富文本引擎替换（仍可用 `contentEditable` + `document.execCommand`，或远期 Markdown）
- 后端真实 LLM 流式进度 WebSocket
- 删除 `NodeFrame` / 旧 `textNodeCard` 样式全集
- 文本节点「真多模态看视频」能力

---

## 2. 设计原则（继承 + 文本特例）

| 原则 | 图片/视频 | 文本节点约定 |
|------|-----------|--------------|
| 壳 = 内容预览 | 图/视频画面 | **正文摘要 / 编辑区**（可滚动） |
| 能力外置 | 顶栏 Chip + 底栏生成 | 顶栏：文档操作；底栏：模型对话 / TTV·TTM·脚本同步 |
| 选中才展开 | `useNodeExpandedChrome` | 同上；**内联编辑中** suppress 底栏 |
| 元信息外置 | 标签 + 分辨率/进度 | 标签 + **字数**；生成中可显示 `生成中 N%`（接 Agent） |
| 弱装饰 | 白描边选中 | 复用 `nodeChrome` Token |
| 双击 | 图片/视频 → 200% 聚焦 | **默认：进入壳内编辑**；可选次行为「展开 Modal」（与产品确认） |
| 多选 | 无 Portal | 无 Portal、无浮动排版条 |

> Chrome Spec §7.2：**文本/脚本正文宜保留在卡内**；只 Portal 化「生成/模型/工作流」区。本方案严格遵守。

---

## 3. 现状差距对照

### 3.1 已实现（保持）

| 项 | 实现 |
|----|------|
| 壳层 | `NodeChromeShell` + `minimal-text-node` |
| 外置标签 | `NodeMetaLabel`，默认「文本」 |
| 右上元信息 | `NodeMetaStatus`，`N 字` |
| 底栏 Portal | `TextNodeBottomPortal` + `useNodeGenerationChrome` |
| 锚点 | `SimpleAnchors` |
| 展开编辑 Modal | `TextNodeExpandEditModal` |
| 粘贴导入 Modal | `TextNodePasteImportModal` |
| 工作流参数 | `params.textWorkflow` 五类 + 底栏分派 |

### 3.2 与图片/视频的主要差距

| 维度 | 图片/视频 | 文本（现状） | 优化方向 |
|------|-----------|--------------|----------|
| 顶栏 Portal | `ImagePreviewToolbarPortal` / `VideoPreviewToolbarPortal` | **无**；下载在壳内浮动钮 | 有正文时顶栏：复制/下载/粘贴导入/展开编辑/同步脚本 |
| 底栏显隐 | 空态常显；有内容默认隐藏，可钉住 | 有正文或 `writeSelf` 时常显 Composer | 对齐：**无正文→底栏 empty**；**有正文→默认隐藏，可钉住** |
| 空态引导 | 节点**上方**居中上传钮 | 壳内虚线卡片「请编写内容」 | 空态：**上方**「开始编写」浮动钮 + 壳内轻占位 |
| 模型选择 | `ImageModelPicker` / `VideoModelPicker` | 原生 `<select>` | `TextProviderPicker`（Portal 菜单） |
| 生成钮 | `igp-generate-btn` 三态 | 白底 ↑ 无运行态 | 复用 CTA 组件与 `data.status` |
| 提示词输入 | `MentionInput` + `/` `@` | Composer 纯 textarea | Composer 换 `MentionInput`（与图/视频一致） |
| TTV 底栏 | 视频节点 `VideoMultimodalInputPanel` | `TextNodeTextToVideoPanel` 独立实现 | **复用** `layout="portal"`，只读 Tab |
| 顶栏配置 | `*ToolbarActions.ts` 数据驱动 | 硬编码在组件内 | `textPreviewToolbarActions.ts` |
| 画布工具条 | `NodeSelectionToolbar` 对图/视频 return null | 仍显示通用工具条 | 文本单选时 **return null**（复制等迁顶栏） |
| 展开 Modal z-index | 55（图） | 未统一常量 | 使用 `GEN_PANEL_EXPANDED_Z` 同级 |
| 进度右上 | `data.status.progress` | 无 | Agent 运行时显示 |

---

## 4. 目标信息架构

```text
                    ┌─ 顶栏 Portal（有正文 + 单选）────────────────────┐
                    │  [文档] 复制 | 下载 | 粘贴导入 | 展开编辑 | 同步*   │
                    └──────────────────────────────────────────────────┘
  左上：文本 N（外置）                    右上：1234 字 | 生成中 42%
  无正文时：节点上方居中「开始编写」浮动按钮（仅单选）
┌─ 节点壳 .minimal-text-node（随画布缩放 500×H）────────────────────────┐
│  ┌─ .minimal-text-preview（正文区）────────────────────────────────┐ │
│  │  空态：轻占位 SVG + 一句引导                                      │ │
│  │  只读：摘要 mono，溢出省略，双击进入编辑                          │ │
│  │  编辑：contentEditable（排版条改到顶栏或壳顶细条，见 §6）         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  ⊕ SimpleAnchors                                                       │
└────────────────────────────────────────────────────────────────────────┘
                    ┌─ 底栏 Portal（500px，锚 preview 下缘）─────────────┐
                    │  layout: empty | composer | ttv | ttm | script    │
                    └──────────────────────────────────────────────────┘

  居中 Modal：TextNodeExpandEditModal（z=55，Esc 不关选中）
  *「同步」仅 scriptToText 或有上游 script 时显示
```

### 4.1 壳内正文区规格

| 状态 | 壳内展示 | 高度策略 |
|------|----------|----------|
| 完全空（无 workflow） | 浅色占位 + 引导文案；不放大块虚线按钮 | `TEXT_NODE_CHROME_HEIGHT_EMPTY` ≈ 220 |
| `writeSelf` 空 | 直接进入编辑（保持） | `TEXT_NODE_CHROME_HEIGHT_WRITE_SELF` ≈ 260 |
| 有正文只读 | 最多显示 **前 N 行** + fade 渐变；完整编辑在双击或 Modal | `TEXT_NODE_CHROME_HEIGHT_BODY` ≈ 300，远期可按字数分级 |
| 编辑中 | 全文可滚动；**不**在壳内再放一整条 FormatBar | 与只读同高或略增 |

**阅读体验**：只读态使用 `textNodeReadOnly--chrome`：行高 1.5、`pre-wrap`、壳底 24px 渐变暗示「还有更多」，与图片「预览区不承载操作」一致。

---

## 5. 显隐状态机（对齐图片 §5.2）

> **⚠️ 已废止（2026-05-20）**  
> 本节 §5.2 表格（四 Chip、顶栏文档组、`showEmptyComposeFloat` 等）**不得再实现**。  
> **真源**：[`text-node-states-spec.md`](./text-node-states-spec.md)（S1–S7 + 显隐矩阵 + 附录 A）。

### 5.1 全局条件

```ts
expandedChrome = selected && !nodeDragSuppressUi && !multiSelect
editing = local // 壳内 contentEditable 聚焦编辑
```

### 5.2 局部条件（建议）

```ts
hasBody = prompt.trim().length > 0
dockedBelow = textGenPanelPinned || pinnedTextGenPanelId === id
showBottomPortal =
  expandedChrome &&
  !editing &&
  (!hasBody || dockedBelow || textWorkflow forces panel) &&
  expandedTextPanelId !== id

showPreviewToolbar = expandedChrome && hasBody
showEmptyComposeFloat = expandedChrome && !hasBody && textWorkflow === undefined
```

| 状态 | 顶栏 | 底栏 | 上方浮动钮 |
|------|------|------|------------|
| 未选中 | 隐藏 | 隐藏 | 隐藏 |
| 单选、无正文、无 workflow | 隐藏 | **empty**（选 workflow 提示） | **显示**「开始编写」 |
| 单选、`writeSelf` 空 | 隐藏 | **composer**（引导模型对话） | 隐藏 |
| 单选、有正文 | **显示** | 默认隐藏；钉住后 **composer** | 隐藏 |
| 单选、`textToVideo` / `textToMusic` | 有正文时显示 | **ttv / ttm**（可钉住） | 隐藏 |
| 单选、`scriptToText` | 显示（含同步） | **script sync** | 隐藏 |
| 内联编辑中 | **显示**（含 format，C4） | 隐藏 | 隐藏 |
| 展开 Modal 打开 | 按上 | 底栏 Portal 隐藏 | 隐藏 |
| 多选 | 隐藏 | 隐藏 | 隐藏 |

**与图片差异说明**：文本的「空态」底栏不是生成图，而是 **workflow 选择 + 一句说明**；`writeSelf` 空态因需即时输入，底栏可同时出现 composer（模型对话）与壳内编辑器——通过 **composer 仅保留一行占位** 降低重复感。

### 5.3 `canvasUiStore` 扩展（建议字段）

| 字段 | 用途 |
|------|------|
| `textGenPanelPinnedNodeId` | 有正文时钉住底栏（全局唯一） |
| `textGenPanelExpandedNodeId` | 居中展开 Modal 时隐藏底栏 Portal |

---

## 6. 交互优化明细

### 6.1 顶栏（新建 `TextPreviewToolbar`）

**数据驱动**：`src/lib/textPreviewToolbarActions.ts`

| 分组 | 动作 | kind | 行为 |
|------|------|------|------|
| `document` | 复制 | utility | `writeClipboardText(prompt)` |
| | 下载 .txt | utility | 现有 `downloadTextAsFile` |
| | 粘贴导入 | utility | 打开 `TextNodePasteImportModal`（target=prompt） |
| | 展开编辑 | utility | `TextNodeExpandEditModal` |
| `workflow` | 从脚本同步 | utility | 仅 `scriptToText` 或检测到上游 script；调用现有 binding |
| `format` | H1/H2/H3/列表… | edit | 编辑态可用；只读时点击先 `setEditing(true)` 再 `execCommand` |
| `tools` | 清空正文 | utility | 确认后清空 `prompt`（可选 stub） |

**UI**：复用 `ImagePreviewToolbar` 胶囊条结构（`nodeChrome--top` + 横向滚动 + 分组竖线）。

**排版条去留**：

- **推荐**：格式类并入顶栏 `format` 组；壳内编辑态不再渲染 `TextNodeFormatToolbar` 浮动条，减少壳内拥挤。
- **备选**：编辑态在壳顶显示 **一条 28px 细条**（非 Portal），仅当 `editing && !expandedChrome` 的边界情况——优先 Portal 方案。

### 6.2 底栏 Composer（对齐 `ImageGenerationPanel`）

| 元素 | 规范 |
|------|------|
| 宽度 | 500px（`TEXT_NODE_CHROME_WIDTH`） |
| 布局名 | `tgp-layout-empty` / `default` / `expanded`（类名前缀 `textGenPanel--chrome`） |
| 输入 | `MentionInput`：`/` 预设、`@` 上游节点引用 |
| 模型 | `TextProviderPicker`（替代 `<select>`） |
| 字数 | 右下角 `tgp-prompt-counter`（对齐 `vgp-prompt-counter`） |
| 发送钮 | 复用 `IgpGenerateButtonIcon` + `--vgp-cta-*` 三态 |
| 顶行 | 移除 `文/A` 晦涩 hint；改为「模型对话」短标签或图标 |
| 钉住/展开 | 复用 `PanelPinIcon` / `PanelExpandIcon` |

**语义拆分（保持数据模型）**：

- `data.prompt`：正文 / 上游消费的主文本（壳内编辑）
- `params.textModelInput`：底栏「对模型说的话」（Composer）
- 顶栏 preset（远期）：可向 `textModelInput` 或 `prompt` 注入模板，需在 actions 注明目标字段

### 6.3 壳内正文编辑

| 操作 | 行为 |
|------|------|
| 单击只读区 | 选中节点，不进入编辑（与图片预览一致） |
| 双击只读区 | `setEditing(true)`，全选正文 |
| 单击浮动「开始编写」 | `mergeParams({ textWorkflow: "writeSelf" })` + focus |
| Blur 编辑区 | 保存 + `setEditing(false)`；`writeSelf` 空且仍无字可保留 workflow |
| Esc | 若在编辑：退出编辑并保存；若 Modal 开：只关 Modal（保持选中） |
| 滚轮 | `stopPropagation`（已有） |

**不再使用**：壳内右上角 `textNodeDownloadFloat`（迁顶栏）。

### 6.4 空态与工作流入口

**问题**：空态大虚线卡片占满壳、与图片「轻占位 + 外置 CTA」不一致。

**方案**：

1. 壳内：小图标 +「输入主题、大纲或粘贴文案」一行字（opacity 0.22 图标，对齐 `minimal-image-placeholder`）。
2. 节点上方：`TextNodeEmptyComposeFloat`（仿 `ImageNodeEmptyUpload`），文案「开始编写」。
3. 底栏 empty：四个 workflow **Chip**（非大按钮）：自己编写 / 文生视频 / 图转提示 / 音乐 / 脚本同步——点击设置 `textWorkflow` 并 `setStatusText` 说明；与锚点菜单 `mergeTextWorkflow` **同一套文案**。

**`imageToPrompt` 空态**：显示「等待上游图片」图标即可，底栏隐藏或显示一句「连接图片节点后自动生成提示词」。

### 6.5 工作流底栏统一

| workflow | 底栏组件 | 说明 |
|----------|----------|------|
| `writeSelf` / 默认 | `TextComposerPanel` | 新封装，内含 Composer |
| `textToVideo` | `VideoMultimodalInputPanel` `layout="portal"` | 绑定 `params.videoNodeId`；Tab 只读；删除 `TextNodeTextToVideoPanel` 重复 UI |
| `textToMusic` | `AudioTtsPanel` 或专用 TTM portal 皮肤 | 与音频节点 TTS 底栏同构（若已有） |
| `scriptToText` | `TextNodeScriptSyncPanel` 精简版 | 保留「同步」主按钮 + 分镜 binding 一行 |

**TTV 迁移收益**：参考图条、模型、画幅、生成钮与视频节点一致，减少 600+ 行分叉维护。

### 6.6 画布级与其它 UI

| 项 | 建议 |
|----|------|
| `NodeSelectionToolbar` | `type === "textNode"` 时 return null |
| 双击画布节点 | **不**绑定 zoom 200%（与矩阵「可选」）；若产品要一致，复用 `focusImageNodeAt200` 改名为 `focusMediaNodeAt200` |
| Delete | 非输入焦点时删节点（对齐图片） |
| Agent 进度 | `runNodeTaskAgent` → `data.status` → 右上「生成中 N%」覆盖字数 |

---

## 7. 视觉 Token 与 CSS

### 7.1 文件规划

| 文件 | 职责 |
|------|------|
| `MinimalTextNode.css` | 从 `TextNodeChrome.css` 演进；壳、占位、只读渐变 |
| `textGenPanel--chrome` | 底栏 token：`--tgp-control-*` 映射 `--vgp-control-*` |
| `nodeChrome/` | 已有 Token，不重复定义色值 |

### 7.2 类名演进

| 现行 | 目标 |
|------|------|
| `textNodeChrome--minimal` | `textGenPanel--chrome`（底栏） |
| `minimal-text-node` | 保留 |
| `scriptGenComposer*` | `tgp-composer-*`（别名过渡期保留） |

### 7.3 移除/禁止回归（对齐 IGP §6.4）

- 红褐色提示条、底栏「T」图标装饰
- 内联 `style={{ padding: "2px 8px" }}` 的粘贴按钮
- 壳内大块虚线 CTA 占满预览区
- 原生 `<select>` 在 Portal 底栏

---

## 8. 实施迭代（建议 4 步）

> 每层迭代遵守：1 核心目标、≤3 模块、2–4 功能点、Out of scope、验收、回滚。

### 迭代 C1 — 显隐状态机 + 顶栏 + 画布分工 ✅（2026-05-20 已实现）

**目标**：有正文时的操作收敛到顶栏 Portal，底栏改为「默隐可钉」。

| 模块 | 改动 |
|------|------|
| `TextNode.tsx` | 接入 `showPreviewToolbar` / `dockedBelow` / `showEmptyComposeFloat` |
| `TextPreviewToolbarPortal.tsx` + `textPreviewToolbarActions.ts` | 新建 |
| `NodeSelectionToolbar.tsx` | textNode return null |

**功能点**：顶栏复制/下载/粘贴/展开；钉住底栏；空态上方浮动钮；移除壳内下载 float；顶栏 **「素材库」占位**（打开空面板 / toast「即将支持」）。

**Out of scope**：Composer 换 MentionInput、TTV 面板迁移；F3 工程级读写（仅占位，见 §13.2）。

**UI/UX**：顶栏胶囊与图片间距一致；浮动钮 `top` 算法对齐 `ImageNodeEmptyUpload`。

**验收**：① 有正文单选见顶栏无底栏 ② 钉住见 composer ③ 多选无 Portal ④ 编辑时顶栏底栏皆隐。

**回滚**：`TextNode` 显隐回退为当前 `showBottomPortal` 逻辑。

---

### 迭代 C2 — 底栏 Composer 对齐 IGP/VGP ✅（2026-05-20 已实现）

**目标**：模型对话区与图片/视频生成面板控件同世代。

| 模块 | 改动 |
|------|------|
| `TextComposerPanel.tsx` | 从 ComposerBar/Input 拆出 |
| `TextProviderPicker.tsx` | 新建 |
| ~~`TextNodeComposerBar.tsx`~~ | 已删除；由 `TextComposerPanel.tsx` 替代 |

**功能点**：`MentionInput`；Provider 上浮菜单；生成中停止；`textGenPanelExpandedNodeId` Modal 布局 `expanded`。

**Out of scope**：TTV 复用视频面板。

**验收**：① `/` `@` 可用 ② 发送后右上进度 ③ Esc 只关 Modal。

**回滚**：保留 `scriptGenComposer` 类名别名。

---

### 迭代 C3 — 工作流底栏收敛 ✅（2026-05-20 已实现）

**目标**：TTV/TTM/script 与媒体节点底栏同构。

| 模块 | 改动 |
|------|------|
| `TextNodeWorkflowPanels.tsx` | 删除 TTV 大面板，改薄包装 |
| `VideoMultimodalInputPanel` | 支持 `hostNodeId=textNode`（若需） |
| 锚点 / `nodeAnchorDispatch` | 文案与底栏 Chip 统一 |

**功能点**：TTV portal 复用；TTM 对齐音频 TTS 皮肤；script 同步保留。

**Out of scope**：新 workflow 类型。

**验收**：文本→视频连线后底栏与视频节点底栏控件一致；Tab 不可手改。

**回滚**：恢复 `TextNodeTextToVideoPanel`。

---

### 迭代 C4 — 壳内阅读态 + 格式条迁移收尾 ✅

**目标**：壳内只负责「读/写正文」，不堆操作条。

| 模块 | 改动 |
|------|------|
| `TextNodeFormatToolbar` | 迁入顶栏或删除 |
| `MinimalTextNode.css` | 只读渐变、占位 SVG |
| `textNodeChrome.ts` | 可选动态高度 |

**功能点**：只读摘要截断；格式操作在顶栏；`writeSelf` 空态壳顶无浮动条。

**验收**：壳内无浮动 FormatBar；双击编辑流畅；长文只读不撑破 500 宽布局。

**回滚**：恢复壳内 `TextNodeFormatToolbar`。

---

## 9. 数据模型（无破坏性扩展）

| 字段 | 说明 |
|------|------|
| `data.prompt` | 正文（不变） |
| `data.label` | 外置标题（不变） |
| `params.textWorkflow` | 五类 workflow（不变） |
| `params.textModelInput` | Composer 输入（不变） |
| `params.textChrome` | **废弃方向**：合并后恒 true，移除分支 |
| `params.providerId` / `model` | Provider 选择（不变） |
| `data.status` | 新增使用：生成进度（与图/视频一致） |

---

## 10. 风险与决策点（需产品确认）

| # | 问题 | 选项 A | 选项 B | 建议 |
|---|------|--------|--------|------|
| 1 | 双击节点 | 进入编辑 | 画布 zoom 200% | **A**（文本主任务即写字） |
| 2 | `prompt` vs `textModelInput` | 底栏仅写 modelInput | 合并为单输入 | 保持双字段，UI 上强化说明 |
| 3 | `writeSelf` 空态 | 壳内编辑 + 底栏 composer 并存 | 仅壳内编辑 | 空态隐藏 composer，有字后再显示 |
| 4 | 只读摘要 | 全文缩小字号 | 固定行数截断 | 固定 8–12 行 + 渐变 |
| 5 | TTV 底栏宿主 | 仍在 textNode Portal | 改到 videoNode 底栏 | 保持 textNode（上游提示词在文本） |
| 6 | 功能 3 素材库 | 工程级全量 | 仅 localStorage | **已决**：工程级全量；**现阶段占位**（§13） |

---

## 11. 手动验收清单（全量回归）

1. 新建文本节点：单选见上方「开始编写」+ 底栏 empty workflow Chips；无壳内大虚线框。
2. 编写正文：失焦后只读；顶栏出现；底栏默认不出现；钉住后出现 Composer。
3. 多选 2 个文本节点：无顶/底 Portal。
4. 双击正文：进入编辑；Esc 退出；顶栏底栏隐藏。
5. Composer：`@` 引用上游、`/` 预设；发送后右上「生成中 N%」。
6. 连接视频走 anchor `textToVideo`：底栏与视频节点一致，创作模式 Tab 灰色不可点。
7. `scriptToText`：顶栏同步可用，正文更新。
8. 展开 Modal：Esc 关闭且保持选中；底栏 Portal 隐藏。
9. 浏览器 `npm run dev`：Portal 定位不漂；无 Tauri API 时不崩溃。
10. 与 Inspector 字段不冲突（若 Inspector 仍暴露 prompt，需同屏一致）。

---

## 12. 文档维护

- 落地后更新 `canvas-node-chrome-spec.md` §7.1 `textNode` 行与 §4 文件表。
- 删除或标注 `global.css` 中 `.textNodeCard` 遗留样式为 deprecated。
- 本文件状态改为「已实现 / 部分实现」并链到 PR。
- F3 落地后更新 `docs/PROJECT_REFERENCE.md` 工程目录说明（`assets/text-snippets/`）。

---

## 13. 功能 3 全量规格：工程级文本素材库

> **范围**：产品功能 3 的完整交付定义。  
> **阶段**：P0 占位（随 Chrome C1）→ P1 工程内闭环 → P2 批量与图库 → P3 跨项目。

### 13.1 设计原则

1. **与媒体素材同一套基础设施**：`assets/` 目录 + `upsert_asset` + `list_assets`；`media_type = "text"`（前端 `AssetKind` 已含 `text`）。
2. **工程可移植**：文案随工程文件夹复制/归档；不依赖浏览器 `localStorage`。
3. **节点记忆体可选引用**：除把全文写入 `data.prompt` 外，可存 `params.textSnippetAssetId` + `params.textSnippetRelPath`（与图节点 `assetId`/`path` 模式对齐），便于「固定文案」节点轻量同步。
4. **全量**：收藏、浏览、插入、重命名、删除、批量入库/出库、跨项目导入导出，均纳入 F3；占位阶段不砍范围，只砍实现深度。

### 13.2 工程目录与索引（真源）

```text
{projectRoot}/
├── canvasflow.json
├── assets/
│   ├── …（现有 image/video/audio）
│   └── text-snippets/          # 新建：文本素材专用子目录
│       ├── logo-slogan.txt
│       ├── ep01-opening.txt
│       └── …
└── .canvasflow/
    └── runs.db                 # assets 表 media_type='text'
```

| 字段 | 约定 |
|------|------|
| 文件格式 | UTF-8 纯文本 `.txt`（首期）；远期可选 `.md` |
| `rel_path` | `assets/text-snippets/{slug-or-uuid}.txt` |
| `media_type` | `text` |
| `source` | `snippet-save` \| `snippet-import` \| `batch-export` |
| `meta_json` | `{ "name": "LOGO 标语", "tags": ["brand"], "charCount": 42 }` |

**可选** `canvasflow.json` 扩展（非必须，索引以 DB 为准）：

```json
{
  "textSnippetDefaults": { "maxPerProject": 200 }
}
```

### 13.3 能力矩阵（全量）

| 能力 | 用户动作 | 行为 |
|------|----------|------|
| **收藏** | 文本节点顶栏/右键「存入素材库」 | 将当前 `prompt` 写入新 `.txt` + `upsert_asset`；可弹窗填名称/标签 |
| **浏览** | 顶栏「素材库」/ 左侧图库 Tab「文本」 | `list_assets` 筛 `text`；列表展示名称、字数、更新时间 |
| **插入** | 在素材库点「插入」 | **替换**或**追加**到 `data.prompt`；可选新建文本节点并填入 |
| **预览** | 列表项 hover / 侧栏 | 只读前 200 字；大段用 Modal |
| **管理** | 重命名、删除、编辑 | 改 `meta_json.name`；删文件 + DB 行；编辑 = 写回文件 |
| **批量入库** | 多选文本节点 →「批量存入素材库」 | 每条生成一个 snippet（名称默认节点 label） |
| **批量出库** | 素材库多选 →「插入为多个节点」 | 画布网格落点创建多个 `textNode` |
| **批量粘贴** | 外部多段文本（按空行/CSV） | 导入向导：每段一条 snippet 或每段一节点 |
| **跨项目** | 另一工程打开 / 导入包 | **方案 A**：只读浏览他工程 `assets/text-snippets`（需打开工程路径）；**方案 B**：导出 `.cfsnippet.json`（名称+内容数组）单文件导入 |
| **与节点关联** | 节点固定引用素材 | `params.textSnippetAssetId` 存在时，展示摘要；「解除关联」后变为独立副本 |

### 13.4 UI 落点（与 Chrome 对齐）

| 入口 | 阶段 | 说明 |
|------|------|------|
| 顶栏 Chip「素材库」 | **P0 占位** | 打开 `TextSnippetLibraryPanel` stub：空状态文案 +「即将支持工程级素材库」 |
| 顶栏「存入素材库」 | P1 | 有正文时可用；P0 可 disabled + tooltip |
| 画布空白右键「保存到我的素材」 | P0→P1 | 去掉「敬请期待」禁用，改为与顶栏同一套（P0 仍 toast 占位） |
| 左侧添加面板 / 图库 Tab | P2 | 新增 **文本** 筛选项，与图片画廊同布局 |
| `TextNodePasteImportModal` | P2 | 增加 Tab「从素材库选择」 |

**占位组件（P0，无后端）**

- `TextSnippetLibraryPanel.tsx`：`layout="portal" | "modal"`，仅 UI 壳 + 空列表。
- `textPreviewToolbarActions.ts`：`snippetLibrary` action，`kind: "stub"` → 打开空面板。
- 不在 P0 调用 `addTextMaterial(localStorage)` 新写入（避免双轨）；现有右键保存可保留并标注「将迁移至工程素材库」。

### 13.5 API / 命令（F3 实现期，P0 不注册）

| 命令（建议名） | 职责 |
|----------------|------|
| `save_text_snippet` | 写文件 + `upsert_asset` + 返回 `assetId` |
| `list_text_snippets` | 封装 `list_assets` 筛选或专用查询 |
| `read_text_snippet` | 读全文（大文件上限如 512KB） |
| `delete_text_snippet` | 删文件 + DB |
| `import_text_snippet_pack` | 跨项目 `.cfsnippet.json` |

前端封装：`src/shared/api/textSnippets.ts`（P0 仅导出类型与 `STUB` 常量）。

### 13.6 迁移与兼容

| 项 | 策略 |
|----|------|
| `textNode.materials.v1`（localStorage） | F3 P1 提供一次性「导入到本工程」；导入后清空或提示废弃 |
| 现有右键 `addTextMaterial` | P1 改为调 `save_text_snippet`；P0 保留但 toast 说明将迁移 |
| 无工程路径（未打开项目） | 素材库入口 disabled：「请先打开工程」 |

### 13.7 实施分期

| 阶段 | 目标 | 交付 |
|------|------|------|
| **P0 占位** | 不阻断 Chrome | 顶栏入口 + 空面板 + 文案；C1 验收项 +1 |
| **P1 工程闭环** | 单工程可用 | 存/列/插/删/读；废弃 localStorage 主路径 |
| **P2 批量 + 图库** | 效率 | 批量入出库、图库 Tab、节点 `textSnippetAssetId` |
| **P3 跨项目** | 全量收尾 | `.cfsnippet` 包、他工程只读浏览 |

**迭代登记**：在 `docs/iterations/` 单开 **F3-text-snippet-library**（实现时再写 ITERATION 正文），与 Chrome C1–C4 解耦。

### 13.8 P0 占位验收（仅 UI）

1. 单选有正文文本节点：顶栏可见「素材库」Chip，点击出现空面板，不报错。
2. 面板内说明含「工程级」「即将支持」；无假数据条目的误导性交互。
3. 未打开工程：入口 disabled 或 toast「请先打开工程」。
4. 浏览器 `npm run dev`：占位面板可开可关，Esc 关闭。

### 13.9 P1–P3 全量验收（摘要）

1. 存入后 `assets/text-snippets/` 出现文件，图库可见，`list_assets` 含 `text`。
2. 关闭重开工程：素材仍在；插入后节点 `prompt` 正确。
3. 批量：3 个文本节点入库 → 3 个文件；素材库多选 → 3 个新节点。
4. 导出 `.cfsnippet` 在新工程导入成功。
5. localStorage 旧数据可一键迁移且无重复。

**回滚**：关闭顶栏入口 feature flag；保留 `localStorage` 路径至迁移完成。

---

*维护者：Canvas 体验层。§10 决策表 #6 已关闭（功能 3）。*
