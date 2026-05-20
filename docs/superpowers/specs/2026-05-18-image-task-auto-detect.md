# 图片节点 Task 自动推断规格

**状态**：草案（评审用）  
**日期**：2026-05-18  
**关联**：`MinimalImageNode`、`ImageGenerationPanel`、`imageGenerationAgent`、`incomingImageReference.ts`、`incomingScriptBinding.ts`

---

## 概述

### 目标

移除生成参数面板中的「文生图 / 图生图 / 多图参考融合 / 图像编辑」四个手动标签，由画布拓扑与上游内容自动决定 `task`，并在 UI 上**只读**展示当前模式。

### 范围

- `imageNode` 生成面板点击「生成」时的单次调用
- 面板只读状态、参考图数量提示、`canGenerate` 逻辑
- 不改变：节点预览、顶栏操作栏、风格 chip、画布定位（`markedNodeId`）

### 非目标

- 替换视频节点 `detectWorkflow`
- 统一所有厂商 API 的 `task` 语义
- Phase A 完整实现「图像编辑」产品定义
- `@` 引用参与参考图计数（见 §2.4）

### 背景（现状）

| 能力 | 现状 |
|------|------|
| Task 选择 | 面板手选 `taskMode`，传 `generate_image_asset` |
| 参考图 | `getIncomingImageRefForNode` 仅首张 `imageNode` |
| Agent | 单条 `referenceImagePaths` |
| 脚本 prompt | 已有 `buildPromptFromScriptBeatBinding`，面板未用 |
| 生成按钮 | 仅看本地 `prompt.trim()`，不看上游聚合 |

---

## 1. 术语

| 术语 | 含义 |
|------|------|
| **有效参考图** | 连入当前 `imageNode` / `imageAsset` 的 `in` 端、边未禁用、源为图片类节点，且 `path` / `assetId` 可解析为工程相对路径 |
| **有效提示词** | `aggregatedPrompt.trim().length > 0`（§3.6） |
| **本节点图** | 当前 `imageNode.data.path` / `assetId`（预览区成片） |
| **上游图** | §2.1 采集列表中的参考图（**不含**本节点自身） |
| **统一上下文** | `resolveImageGenerationContext(nodeId)` 一次解析产出（§2.0） |

---

## 2. Task 推断规则

推断在**每次生成前**与**面板只读状态刷新时**各执行一次，使用**同一函数** `resolveImageGenerationContext(nodeId)`，避免「显示文生图、点击后变图生图」。

### 2.0 统一上下文

一次解析产出：

| 字段 | 说明 |
|------|------|
| `incomingImageRefs` | 上游有效参考图列表（有序，最多 4） |
| `aggregatedPrompt` | §3 聚合后的提示词（trim 后） |
| `task` | 推断的 `ImageTaskMode` |
| `referenceImagePaths` | 传入 API 的相对路径列表 |
| `blockReason` | 非空则禁止生成，并用于 statusText |
| `warnMessage` | 非空则生成继续，仅提示 |

面板 `canGenerate`、只读标签「当前：xxx」、生成逻辑**只读此上下文**。

### 2.1 有效参考图采集

1. 扫描连入当前 `imageNode` / `imageAsset` 的 `in` 端、**边未禁用**的连线。
2. 源节点类型为 `imageNode` 或 `imageAsset`，且 `path` / `assetId` 至少一项非空。
3. 解析为工程内相对路径；解析失败记入 `blockReason`，该张不计入数量。
4. 同一 `source` 只计一次；按源节点 `position.y` **升序**排序。
5. 最多保留 **4** 张；超出时 `warnMessage = "仅使用前 4 张参考图"`，并截断列表。

> **实现注记**：须扩展/替换现有 `getIncomingImageRefForNode`（当前仅认首张 `imageNode`）。`imageAsset` 与 `imageNode` 同等对待。

**不计入上游参考**：本节点自身的 `path` / `assetId`（见 §2.5）。

### 2.2 Task 推断（互斥）

在 `aggregatedPrompt` 已通过 §3.6 校验的前提下：

```
n = incomingImageRefs.length

IF n == 0
  → task = text_to_image
  → referenceImagePaths = []

ELSE IF n == 1
  → task = image_to_image
  → referenceImagePaths = [ refs[0] ]

ELSE IF n ∈ [2, 4]
  → task = multi_ref_fusion
  → referenceImagePaths = refs[0..n-1]

ELSE IF n > 4   // 已在 2.1 截断为 4
  → task = multi_ref_fusion
  → referenceImagePaths = refs[0..3]
```

**`image_edit`**：本版**不自动推断**。Phase B 再议；Phase A 有 1 张上游图时一律 `image_to_image`。

> **实现注记**：`multi_ref_fusion` 依赖 Agent 传 `reference_image_paths[]`（§8 A2）。A2 未完成前：不得在 UI 展示「多图融合」，或展示但阻断并提示「多图参考尚未支持」。

### 2.3 与手动四标签的映射

| 原标签 | 自动推断条件 |
|--------|----------------|
| 文生图 | 上游参考图 = 0 且 有效提示词 |
| 图生图 | 上游参考图 = 1 |
| 多图参考融合 | 上游参考图 = 2～4（>4 截断） |
| 图像编辑 | Phase A 不自动；Phase B 显式入口 |

### 2.4 `@` 引用与连线的关系

- **Task 推断仅以画布连线为准**（§2.1），`MentionInput` 的 `@` **不参与**参考图计数与 task 选择。
- `@` 仅参与 **prompt 正文**（若 `resolveMentionTokens` 已解析进 `data.prompt` 或生成时解析）。

### 2.5 本节点已有图、上游参考图为 0

**Phase A 采用方案 R1（写死）**：

| 条件 | task | 行为说明 |
|------|------|----------|
| 上游 0 张 + 有 `aggregatedPrompt` | `text_to_image` | 不把本节点 `path` 作为 API 参考图；成功则**覆盖**本节点预览图 |
| 上游 0 张 + 无 `aggregatedPrompt` | — | 阻断（§5.1） |

「在现有图上改」须连上游图片节点，或等 Phase B「编辑模式」。若改 **R2**（0 上游 + 本节点有 path → `image_to_image` 且 reference=本节点 path），须单独立项。

### 2.6 多个上游 scriptNode

- 使用 `orderedIncomingScriptNodeIds`（`incomingScriptBinding.ts`）。
- **推荐（写死）**：若 **≥2 个**启用脚本上游 → `blockReason`（§5.1），不静默取第一个。
- 仅 **恰好 1 个**启用脚本上游时，才用 `buildPromptFromScriptBeatBinding`（§3.1）。

---

## 3. 提示词聚合规则

### 3.0 与 UI / `canGenerate` 同步

1. **生成时** prompt = `aggregatedPrompt`（§3.2～3.4），不是仅面板局部 state。
2. **`canGenerate`**：`projectPath` 存在 ∧ `aggregatedPrompt.length > 0` ∧ `blockReason` 为空。
3. **自动填入（与视频一致）**：`data.prompt` 为空时，若 `buildPromptFromScriptBeatBinding` 有值，写入 `data.prompt` 并更新输入框（`scriptBeatId` / 节点 id 变化时重置）；**不覆盖**用户已填的非空本地 prompt。
4. 只读状态行在 `aggregatedPrompt` 或 `incomingImageRefs` 变化时重算 `resolveImageGenerationContext`。

### 3.1 脚本镜头

**须同时满足**：

- `params.scriptBeatId` 非空；
- 至少一条启用的 `scriptNode → 本 imageNode` 连线；
- `buildPromptFromScriptBeatBinding(nodes, edges, nodeId)` 返回非空。

内容：`visualPrompt` 优先，否则 `scriptBeats[].description`（与现网函数一致）。

**不满足时**：脚本连线**不**自动贡献 prompt（无 beatId ≠ 自动文生图）。

### 3.2 上游文本节点

- 源类型：`textNode`、`llm`（text 输出）。
- 按源 Y 升序，取 `data.prompt` 非空片段。
- **最多 3 条**；超出 `warnMessage`：「仅使用前 3 段上游文本」。
- 片段间 `\n\n` 连接。

### 3.3 本节点面板输入

- `imageNode.data.prompt`。

### 3.4 拼接顺序与去重

```
[脚本镜头]? + [上游文本 1..k] + [本节点 prompt]
```

相邻段 trim 后完全相同则去重。生成前再 `buildImagePromptWithStyles(styleIds)`。

### 3.5 长度上限

遵守 `IMAGE_GENERATION_PROMPT_MAX_CHARS`。**截断（写死）**：保留**尾部本节点 prompt** 整段；前部（脚本、上游文本）从前往后填充至满额；无本节点 prompt 时从前往后截断。

### 3.6 有效提示词校验

```text
aggregatedPrompt.trim().length > 0  → 有效
否则 → blockReason（§5.1）
```

---

## 4. API / Agent 传参

| 推断 task | `reference_image_paths` | `taskNeedsRef` |
|-----------|-------------------------|----------------|
| `text_to_image` | `[]` | false |
| `image_to_image` | 长度 1 | true |
| `multi_ref_fusion` | 长度 2～4 | true |

- `task` 透传 `generate_image_asset`（`media_gen_cmd.rs`）。
- Agent：`task !== "text_to_image"` 时至少 1 条可解析路径。
- 风格：继续 prompt 后缀注入（`buildImagePromptWithStyles`），不用无效 `style` API 字段（Seedream 5.0 Lite）。

**A2 变更**：`imageGenerationAgent.execute` 传完整 `referenceImagePaths` 数组，不再只传单条。

---

## 5. 阻断、警告与边界

### 5.1 阻断生成（`blockReason`）

| 场景 | 文案（可微调） |
|------|----------------|
| 无有效提示词 | 请输入提示词，或绑定脚本镜头 / 连接文本节点。 |
| task 需参考图但 0 张有效上游图 | 请连接已出图的图片节点作为参考，或先上传/生成参考图。 |
| 参考图路径均解析失败 | 无法解析参考图，请检查素材是否已导入工程。 |
| 工程未打开 | 请先新建或打开工程目录后再生成图片。 |
| 多个启用脚本上游（§2.6） | 检测到多个脚本节点，请只保留一条脚本连线。 |
| A2 未就绪且 n≥2（保守策略） | 多图参考功能尚未就绪，请暂时只连接 1 张参考图。 |

### 5.2 警告但继续（`warnMessage`）

| 场景 | 文案 |
|------|------|
| 上游图 > 4 | 仅使用前 4 张参考图。 |
| 上游文本 > 3 条 | 仅使用前 3 段上游文本。 |
| text/script 片段为空 | 静默忽略 |

### 5.3 常见场景速查

| 场景 | task | prompt | 备注 |
|------|------|--------|------|
| 仅文本 → 图，有文本 | `text_to_image` | 聚合 | ✓ |
| 脚本 → 图，无 beatId | — | 无脚本段 | 阻断，除非手填 prompt |
| 脚本 → 图，有 beatId | `text_to_image`（0 图） | 含脚本 | Hermes 典型 |
| 1 张上游已出图 | `image_to_image` | 聚合 | ✓ |
| 2～4 张上游已出图 | `multi_ref_fusion` | 聚合 | 依赖 A2 |
| 本节点有图、0 上游、有 prompt | `text_to_image` | 聚合 | **R1：旧图不作 reference** |
| 禁用边 | — | — | 不参与 |
| `@` 有图、无连线 | 按 0 上游 | `@` 仅正文 | §2.4 |

### 5.4 与视频节点差异

视频可在无 prompt 时 `workflow = null`；**图片无有效 `aggregatedPrompt` 一律阻断**，不做「模式全灭」。

---

## 6. UI 行为

### 6.1 生成面板

- **移除**：`igp-task-mode-group` 四按钮。
- **新增（只读）**：如 `当前：文生图` / `当前：图生图（1 张参考）` / `当前：多图融合（3 张参考）`。
- 与 `resolveImageGenerationContext` 同步刷新。

### 6.2 参考图提示

- `refCount === 0`：不显示  
- `1`：「已连接 1 张参考图」  
- `n≥2`：「已连接 n 张参考图」

### 6.3 选中 / 关闭

与现网一致：选中显示顶栏 + 底栏；取消选中隐藏。`blockReason` 不自动关面板。

### 6.4 全局 NodeSelectionToolbar

`imageNode` 单选时不显示全局 pill 工具栏（已由 `MinimalImageNode` 顶栏承担）。其他节点类型不变。

---

## 7. 与视频节点的一致性

| 维度 | 视频 `detectWorkflow` | 图片本规格 |
|------|----------------------|------------|
| 输入 | image / video / audio | 仅 image 参考 |
| 无有效输入 | workflow 可 null | 无 prompt 则阻断 |
| 排序 | 源 Y 升序 | 同左 |
| UI | 工作流按钮高亮 | 只读「当前：xxx」 |
| 脚本 | beat 同步 + 自动填空 | §3.0 + `buildPromptFromScriptBeatBinding` |
| 统一函数 | draft + items | `resolveImageGenerationContext` |

---

## 8. 实现分期

| 阶段 | 内容 | 验收 |
|------|------|------|
| **A1** | `collectIncomingImageRefs` + `resolveImageGenerationContext` + `detectImageTask` | 单测覆盖 §5 表 |
| **A2** | Agent 多路径；去掉四标签 + 只读状态；`canGenerate` 用聚合 prompt | 1/2/3 张上游图 API 正确 |
| **A3** | §3 聚合 + 脚本自动填入；扩展 `imageAsset` 采集 | 脚本→图节点 Hermes 链 |
| **B** | `image_edit` 或 R2 本节点作 reference | 产品 + API 签字 |
| **C** | 模型能力表：不支持 multi_ref 时降级并提示 | 设置可配置 |

建议新增文件：

- `src/lib/imageGeneration/resolveImageGenerationContext.ts`
- `src/lib/imageGeneration/collectIncomingImageRefs.ts`（或合入上一文件）

---

## 9. 手动验收清单

1. 仅文本 → 图片，有 prompt → 「文生图」，生成成功。  
2. 1 张上游已出图 → 「图生图」，请求 1 条 reference。  
3. 3 张上游图 → 「多图融合（3 张）」，请求 3 条 reference（A2 后）。  
4. 5 张上游 → 警告 + 仅用 4 张。  
5. 上游 image 未出图 → 阻断。  
6. 脚本 Hermes：beatId + 镜头文案，0 参考 → 文生图。  
7. 脚本连线无 beatId、无手填 prompt → 阻断。  
8. 本节点有图、0 上游、有 prompt → 文生图，新图覆盖预览（R1）。  
9. 取消选中 → 顶栏/底栏/状态消失。  
10. 非 image 节点仍用原 `NodeSelectionToolbar`。

---

## 10. 待评审决策项

| # | 项 | 建议 |
|---|-----|------|
| 1 | §2.5 本节点有图 | **R1**（已写死） |
| 2 | §2.6 多脚本 | **阻断**（已写死） |
| 3 | §3.5 截断 | 保尾部本节点（已写死） |
| 4 | A2 前 n≥2 | 阻断或暂封顶 1 张（§5.1 保守策略） |
| 5 | `image_edit` | Phase A 不自动 |
| 6 | 开发态强制 task | 可选设置项，默认关 |

---

## 11. 相关代码索引

| 文件 | 说明 |
|------|------|
| `src/components/nodes/ImageGenerationPanel.tsx` | 移除 task 按钮；接上下文 |
| `src/components/nodes/MinimalImageNode.tsx` | Portal 顶/底栏；传入聚合逻辑 |
| `src/lib/nodeAgentRuntime/imageGenerationAgent.ts` | 多 reference + task |
| `src/lib/incomingImageReference.ts` | 待扩展多图 / imageAsset |
| `src/lib/incomingScriptBinding.ts` | `buildPromptFromScriptBeatBinding` |
| `src/lib/imageGeneration/catalog.ts` | `ImageTaskMode` 常量 |
| `src-tauri/src/commands/media_gen_cmd.rs` | `task` + `images[]` |
| `src/hooks/useVideoIncomingReferenceItems.ts` | `detectWorkflow` 参考实现 |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-18 | 初稿 + §2/§3/§5 修订合并（自检：prompt/UI 同步、脚本 beatId、R1、imageAsset、A2 依赖） |
