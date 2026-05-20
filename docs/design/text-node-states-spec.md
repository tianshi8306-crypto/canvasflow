# 文本节点七种状态 · 规划表（含显隐矩阵）

> **版本**：1.1  
> **日期**：2026-05-20  
> **状态**：**产品真源（Planning）** — 状态机、分工、显隐以本文为准  
> **v1.1**：按「工作流容器 vs 孤立起稿」重划底栏；连线传递/接收时文本节点仅为正文展示与编辑，不出现参数生成面板  
> **迭代层**：CanvasExperienceLayer  
> **基准规范**：[`docs/node-ui-spec/canvas-node-chrome-spec.md`](../node-ui-spec/canvas-node-chrome-spec.md)  
> **实现入口**：`src/components/nodes/TextNode.tsx`  
> **关联文档**：[`text-node-chrome-optimization.md`](./text-node-chrome-optimization.md)（C1–C4 工程迭代史；与本文冲突时以**本文状态机**为准）

---

## 1. 文档用途

| 文档 | 角色 |
|------|------|
| **本文（规划表）** | 定义 S1–S7、六层分工、显隐矩阵、已决/待决 |
| **附录 A（对照表）** | 规划 vs `TextNode.tsx` 当前实现，供评审与回归 |
| `text-node-chrome-optimization.md` | 历史方案与 C1–C4 拆解；**不再**作为状态机真源 |

---

## 2. 核心模型：正文容器 + 工作流分工

### 2.0 用户心智（真源）

文本节点的本质是 **`data.prompt` 正文载体**：

| 方向 | 典型连线 | 行为 |
|------|----------|------|
| **出** | 文本 → 脚本 / 图片 / 视频 / 音频 | 下游读取正文去生成脚本、图、片、音乐；文本节点**只展示/编辑字** |
| **入** | 图片 → 文本 | 图理解模型把反推结果**写入** `prompt` |
| **入** | 视频 → 文本 | 视频节点顶栏「反推视频词」→ 多模态 LLM 写入下游 `prompt` |
| **入** | 图片 → 文本 | 图片节点顶栏「反推提示词」→ 同上 |
| **入** | 脚本 → 文本 | 脚本内容同步进 `prompt`（同步动作可在脚本侧/运行图，不在文本底栏堆参数 UI） |

**硬规则**：只要处于上述任一工作流连线（`isPassiveTextContainer`），**禁止**在文本节点下出现 Composer、VGP、脚本同步条等「参数生成面板」。

**例外（主动起稿）**：画布上**孤立**文本节点（无上述媒体/脚本连线）时，空态可开 Composer 用模型写初稿；成稿后默认无底栏，可 `Ctrl+Shift+G` 钉住 Composer。

实现：`src/lib/textNodeContainerMode.ts` · `TextNode.tsx`。

### 2.1 为什么是「七种」（展示态编号，非底栏模式）

产品口语称「六种状态」，编号仍用于壳/顶栏；**底栏不再按 S5a/S5b/S6 各挂一套生成 UI**。

另加 **S0 非展开**（未单选 / 多选 / 拖拽收起），画布上不出现 Portal。

### 2.2 七种工作状态（S1–S7）

| ID | 名称 | 用户心智 | 进入条件（充分） |
|----|------|----------|------------------|
| **S1** | 初始引导 | 刚放上画布，通过连线扩展能力 | `expandedChrome` ∧ `!hasBody` ∧ `!editing` |
| **S2** | 壳内自编辑 | 我在写稿 | `editing === true`（双击占位/只读区进入） |
| **S3** | 成稿浏览 | 写好了，在画布上选中/拖动 | `hasBody` ∧ `!editing` ∧ 无强制工作流底栏占满 |
| **S4** | 模型写正文 | 孤立节点用 AI 起稿/改稿 | `!isPassiveTextContainer` ∧（空态 **或** 钉住 Composer） |
| **S5 工作流容器** | 连线传递/接收 | 编辑或只读正文 | `isPassiveTextContainer` — **无底栏**；参数在关联节点 |

`params.textWorkflow` 仍由 `inferTextWorkflowPatch` 静默写入，供定位关联节点、状态提示；**不再**驱动文本节点底栏种类。

| workflow（数据） | 含义 | 文本节点底栏 |
|------------------|------|--------------|
| `textToVideo` 等 | 图结构标记 | **关**（视频参数在 `videoNode`） |
| `imageToPrompt` | 图→文 | **关**（反推执行在运行图/后续入口） |
| `scriptToText` | 脚本→文 | **关**（同步不进底栏参数条） |

### 2.3 六层分工（能力归谁）

| 层 | 职责 | 组件 / 入口 | 不做什么 |
|----|------|-------------|----------|
| **L1 壳** | 正文读写、`prompt` 展示 | `NodeChromeShell` + 只读/可编辑区 | 不放模型选择、不放工作流 Chip |
| **L2 外置元信息** | 标题、字数、生成进度 | `NodeMetaLabel` / `NodeMetaStatus` | 不占壳内面积 |
| **L3 顶栏** | 编辑期排版 | `TextPreviewToolbarPortal`（**仅 format**） | 复制/下载/素材库/工作流 Chip（**已取消**） |
| **L4 Composer** | 孤立起稿：对模型说话 → 回写 `prompt` | `TextComposerPanel`（仅非容器） | 工作流容器态 **禁止** |
| **L5 工作流底栏** | （废止） | — | 生成参数一律在图片/视频/音频/脚本节点 |
| **L6 图结构** | 发现工作流、绑定上下游 | 锚点 `nodeAnchorDispatch` + `inferTextWorkflowPatch`（静默） | 壳内「尝试」四入口（**已取消**） |

**数据分工（不变）**：

- `data.prompt` — 正文（壳）
- `params.textModelInput` — Composer 输入
- `params.textWorkflow` + `videoNodeId` / `audioNodeId` / `scriptNodeId` — 连线推断

---

## 3. 全局谓词

```ts
expandedChrome = selected && !nodeDragSuppressUi && selectedNodeIds.length === 1
hasBody = prompt.trim().length > 0
editing = local useState（双击进入；失焦/Esc/取消选中退出）
isComposerPinned = canvasUiStore.textGenPanelPinnedNodeId === nodeId
isComposerExpanded = canvasUiStore.textGenPanelExpandedNodeId === nodeId  // Modal
```

**workflow 来源**：`onConnect` / `onEdgesChange` / `loadGraph` → `applyTextWorkflowSyncToNodes`（**不写撤销栈**）。锚点菜单 `mergeTextWorkflow` 与推断并存，以图结构为准。

---

## 4. 显隐矩阵（规划真源）

图例：**开** = 显示 · **关** = 隐藏 · **—** = 不适用  

**前提**：下列 S1–S7 均默认 `expandedChrome === true`；**S0** 行为见首行。

| 状态 | 壳内容 | L3 顶栏 | L4 Composer | L5 脚本底栏 | S5a VGP | 右下角拉伸 | 锚点 |
|------|--------|---------|-------------|-------------|---------|------------|------|
| **S0** 未展开 | 紧凑预览 | 关 | 关 | 关 | 关 | 关 | 开 |
| **S1** 初始引导 | 空态 glyph + 占位 + 锚点提示 | 关 | **开**（default / i2p / ttm layout） | 关 | 关 | 开 | 开 |
| **S2** 壳内编辑 | `contentEditable` | **format + 图标** | 关 | 关 | 关 | 关 | 开 |
| **S3** 成稿浏览 | 只读 + 渐变截断 | **仅图标**（复制/展开） | **关**（孤立可钉住→S4） | 关 | 关 | 开 | 开 |
| **S4** 模型写正文 | 同 S3 或 S1 | 关 | **开**（仅 `!isPassiveTextContainer`） | 关 | 关 | 开 | 开 |
| **S5 工作流容器** | 同 S3 | 关 | **关** | 关 | **关** | 开 | 开 |

### 4.1 Composer 打开规则（v1.1）

```text
expandedChrome ∧ uiSelected ∧ ¬editing ∧ ¬isPassiveTextContainer ∧ (¬hasBody ∨ isComposerPinned)
```

`isPassiveTextContainer`：存在任一连线 — 文本 →（视频|音频|脚本|图片）或（图片|视频|脚本）→ 文本。

### 4.2 顶栏（规划）

- **Portal 开**：`expandedChrome ∧ hasBody`
- **format 组**：仅 `editing === true` 时显示
- **图标工具**（复制、展开编辑、粘贴导入、下载 .txt）：有正文即可（S3 / S2），无长文案 Chip
- 空占位进入编辑（尚无正文）时 **不开** 顶栏 Portal

### 4.3 展开 Modal（规划）

- Composer 点「展开」→ `textGenPanelExpandedNodeId`；居中 Modal，Esc 关闭
- **规划要求**：Modal 打开时，节点下缘 **底栏 Portal 应关闭**（避免双 Composer）

### 4.4 交互（规划）

| 操作 | 行为 |
|------|------|
| 单击壳内只读区 | 选中节点，**不**进入编辑 |
| 双击空态 / 只读区 | 进入 S2 |
| 单击画布 | 取消选中；取消钉住（`textGenPanelPinnedNodeId` 清空） |
| `Ctrl+Shift+G` | 单选文本节点 → 钉住 Composer；若已 S5a（有 video）→ 仅提示用 VGP |
| 右键「打开模型对话」 | 同钉住规则 |
| 滚轮在壳/底栏 | `stopPropagation` |
| 连线完成 | 静默更新 `textWorkflow` |

---

## 5. 工作流与锚点（L6）

| 连线拓扑 | `textWorkflow` | 用户可见变化 |
|----------|----------------|--------------|
| 文本 → 视频 / 图 / 脚本 / 音频 | 推断 `textWorkflow` + 关联 id | **容器**：无底栏；去目标节点生成 |
| 图片 / 视频 / 脚本 → 文本 | 推断 workflow | **容器**：无底栏；正文由运行图或同步写入 |
| 文本 → 脚本（出边） | 推断未单列时仍 `isPassiveTextContainer` | 脚本节点读上游 `prompt`（`aggregateImagePrompt` / Rust 文本聚合同理） |

**已决**：不在壳内提供「自己编写 / 文生视频 / 图反推 / 音乐」四按钮；能力等价于锚点 + 上表。

---

## 6. Composer 布局（L4）

| layout | 场景 | 要点 |
|--------|------|------|
| `default` | 默认 / `writeSelf` / 未连视频的 TTV | MentionInput、`TextProviderPicker`、1024/200k 字数策略见实现 |
| `imageToPrompt` | S5b | 上游图缩略；默认反推提示文案 |
| `textToMusic` | S6 | 占位「描述您想要的音乐」；计数 1024；已连音频显示节点名提示 |
| `expanded` | Modal | 随 workflow 选 layout（非一律 default） |

---

## 7. 已决 / 待决 / 不做

### 7.1 已决（2026-05-20）

| 决策 | 说明 |
|------|------|
| 无工程素材库 | 顶栏/右键不做素材库 |
| 顶栏仅 format | 复制/下载/粘贴/工作流 Chip 不进顶栏；复制节点走画布/右键 |
| 无壳内四入口 | 工作流靠锚点 + 连线推断 |
| 工作流容器无底栏 | `isPassiveTextContainer` 时禁止 Composer/VGP/脚本条 |
| 孤立空态可 Composer | 仅无媒体/脚本连线时空态起稿 |
| 生成参数在目标节点 | 视频 VGP、图片 IGP、音频 TTS、脚本工作台 |
| workflow 同步 silent | 不进撤销栈 |
| 双击编辑、单击选中 | 与图片预览一致 |

### 7.2 待决（P2+）

| 项 | 选项 |
|----|------|
| S6 图六专用音乐 UI | 独立 Mureka 风底栏 vs 维持 Composer |
| ~~S3 成稿顶栏~~ | ✅ 已恢复仅图标复制/展开（`TextPreviewToolbar`） |
| Modal 开时隐藏底栏 Portal | ✅ 已实现 |
| `writeSelf` 字段 | 数据保留，UI 无入口 |

### 7.3 明确不做

- 壳内 `TextNodeEmptyComposeFloat`「开始编写」浮动钮（图一硬抄后取消）
- 空态 workflow 四 Chip 底栏（`text-node-chrome-optimization.md` 旧 C1 描述）
- TTV 无视频时的 stub 大面板（改为壳内一句提示 + 可选 Composer）

---

## 8. 手动验收（按状态）

1. **S0**：多选文本节点 → 无顶栏/底栏/VGP。  
2. **S1**：新建空文本 → 空态 glyph；底栏 Composer（无标题行）；无四入口。  
3. **S2**：双击 → 可编辑；有正文时顶栏 format；底栏与 VGP 关。  
4. **S3**：失焦 → 只读；无底栏；钉住后出现 Composer（S4）。  
5. **S5a**：连视频 → 仅 VGP；`Ctrl+Shift+G` 提示用视频面板。  
6. **S5b**：连图 → Composer 见缩略图。  
7. **S6**：连音频 → Composer 音乐 layout + 关联文案。  
8. **scriptToText**：脚本同步底栏；无 Composer。  
9. 展开 Modal：Esc 关闭；底栏不重复（见附录）。  

---

## 附录 A · 实现对照表

> **快照日期**：2026-05-20 · **对照文件**：`TextNode.tsx`、`TextComposerPanel.tsx`、`App.tsx`、`CanvasContextMenus.tsx`  
> 图例：✅ 符合 · ⚠️ 部分符合 · ❌ 未实现 · — 不适用

### A.1 显隐矩阵对照

| 状态 | UI 层 | 规划 | 实现 | 备注 |
|------|-------|------|------|------|
| S0 | 全部 Portal | 关 | ✅ | `useNodeExpandedChrome` |
| S1 | Composer | 开 | ✅ | `!hasBody` 等条件 |
| S1 | 四 workflow Chip | 关 | ✅ | 已移除 |
| S1 | 浮动「开始编写」 | 关 | ✅ | 已删 `TextNodeEmptyComposeFloat` |
| S2 | format 顶栏 | 开（有正文且编辑） | ✅ | `showFormatInToolbar` |
| S3 | 顶栏图标工具 | 开（有正文浏览） | ✅ | `showPreviewTopPortal` |
| S2 | 空编辑顶栏 | 关 | ✅ | `!hasBody` |
| S2 | Composer | 关 | ✅ | `!editing` |
| S3 | Composer | 关 | ✅ | 默隐 |
| S3 | Composer 钉住 | 开 | ✅ | `textGenPanelPinnedNodeId` |
| S4 | Composer | 开 | ✅ | 同 S1/S3 钉住逻辑 |
| S5a | VGP | 开 | ✅ | `VideoGenerationPanelPortal` |
| S5a | Composer | 关 | ✅ | `textToVideo && videoNodeId` 排除 |
| S5b | Composer i2p | 开 | ✅ | `layout=imageToPrompt` |
| S6 | Composer ttm | 开 | ✅ | `layout=textToMusic` |
| S6 | 图六专用音乐条 | Composer 为主（已决） | ✅ | 不单独做 Mureka 条；见 §7.1 |
| S6 | AudioTtsPanel 叠层 | 关 | ✅ | 已改为文案提示 |
| S6 | 定位音频节点 | 有 `audioNodeId` 时 | ✅ | `tgp-partner-focusBtn` |
| S5a | 定位视频节点 | 文本托管 VGP 时 | ✅ | `VideoGenerationPanelPortal` |
| S5b | 定位图片节点 | 有上游图时 | ✅ | i2p Composer |
| script | 定位脚本 | 有 `scriptNodeId` 时 | ✅ | `TextNodeScriptSyncPanel` |
| script | 同步底栏 | 开 | ✅ | `TextNodeScriptSyncPanel` |
| script | Composer | 关 | ✅ | `usesWorkflowBottomPanel` |
| 任意 | Modal 时底栏 Portal | 关 | ✅ | `isComposerExpanded` 关闭底栏 + VGP |
| 任意 | 选中取消钉住 | 清空 pin | ✅ | `useEffect` on `!selected` |

### A.2 分工 / 入口对照

| 项 | 规划 | 实现 |  |
|----|------|------|--|
| L6 连线推断 | `applyTextWorkflowSyncToNodes` | ✅ | `textNodeWorkflowSync.ts` |
| 静默 sync | 不进 undo | ✅ | 单次 `set` |
| 锚点菜单 | 合并 workflow | ✅ | `nodeAnchorDispatch.ts` |
| 顶栏仅 format + 图标工具 | 是 | ✅ | `TextPreviewToolbar` |
| 粘贴导入 Modal | 顶栏/右键 | ✅ | `TextNodePasteImportModal` |
| 右键打开模型对话 | 钉住 | ✅ | `CanvasContextMenus.tsx` |
| `Ctrl+Shift+G` | 钉住 / S5a 提示 | ✅ | `App.tsx` |
| 壳内下载 float | 无 | ✅ | 已移除 |
| 节点选中工具条 | textNode 隐藏 | ✅ | `NodeSelectionToolbar` `usesNodeChrome` |
| 右下角拉伸 | 选中且非编辑 | ✅ | `TextNodeResizeHandle` |

### A.3 代码锚点（便于改矩阵时搜索）

| 谓词 / 行为 | 位置 |
|-------------|------|
| `showComposerPortal` | `TextNode.tsx` |
| `isComposerExpanded` / `showBottomPortal` | `TextNode.tsx` |
| `showPreviewTopPortal` / `showFormatInToolbar` | `TextNode.tsx` |
| `showTtvVideoPortal` | `TextNode.tsx` |
| `applyTextWorkflowSyncToNodes` | `textNodeWorkflowSync.ts` + `projectStore.ts` |
| Composer layout | `TextComposerPanel.tsx` |
| Expanded Modal layout | `TextComposerPanelExpandedModal.tsx` |
| 定位关联节点 | `useFocusLinkedPartnerNode.ts` · 单测 `useFocusLinkedPartnerNode.test.ts` |

### A.4 建议下一迭代（来自对照缺口）

1. ~~**P1**：Modal 打开时关闭底栏 Portal~~ ✅ 已实现。  
2. ~~**P2**：S6 图六专用 UI~~ — 按 §7.1 已决采用 Composer，不另做底栏。  
4. ~~**P4**：定位音频节点~~ ✅ `TextComposerPanel`「定位音频节点」。  
5. ~~**P5**：定位视频节点~~ ✅ 文本托管 VGP 顶栏「定位视频节点」。  
6. ~~**P6**：定位图片节点~~ ✅ S5b Composer「定位图片节点」。  
7. ~~**P7**：定位脚本节点~~ ✅ 脚本同步底栏「定位脚本」。  
8. ~~**共用**：`useFocusLinkedPartnerNode`~~ ✅。  
9. ~~**P8**：顶栏粘贴导入 / 下载正文~~ ✅ 图标 + `TextNodePasteImportModal`。  
3. ~~**P3**：`text-node-chrome-optimization.md` 废止旧显隐表~~ ✅ 文首已指向本文。

---

## 9. 文档维护

| 变更类型 | 更新 |
|----------|------|
| 产品改显隐 | 先改 §4 矩阵，再改附录 A，最后改代码 |
| 仅实现细节 | 可只改附录 A 与代码注释 |
| 新增 workflow | 增列 S×、改 §5 与 `TextWorkflowKind` |

**维护者**：改 `TextNode.tsx` 中任一 `show*` 条件时，**必须**同步附录 A 对应行。
