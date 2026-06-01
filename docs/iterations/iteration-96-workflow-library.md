# iter-96 · 工作流库（保存与跨画布复用 · P0）

> **层**：CanvasExperienceLayer  
> **产品背景**：用户需将画布上已搭好的「节点 + 连线」保存为可命名片段，在**其他 Tab / 其他工程**中一键插入，而不只依赖分组工具箱或剪贴板。  
> **与现有能力关系**：在 [`画布打组功能方案.md`](../product/画布打组功能方案.md) iter-16-D「工具箱模板」上扩展；**不**与 Hermes「计划模板」（`hermesPlanTemplates.ts` 步骤链）混为一谈。  
> **状态**：**P0 已实施**（本机 + 工程库；导入导出留 iter-97）  
> **更新**：2026-05-28

### PR 拆分（模块 A → B → C，堆叠合并）

| PR | 分支 | 模块 | 合并基线 |
|----|------|------|----------|
| 1 | `feat/iter-96-workflow-a` | A 快照与存储 | `feat/hermes-p2-agent-experience` |
| 2 | `feat/iter-96-workflow-b` | B store 插入 | PR#1 |
| 3 | `feat/iter-96-workflow-c` | C 画布 UI | PR#2 |

---

## 0) 概念与边界

| 概念 | 存什么 | 用在哪 |
|------|--------|--------|
| **画布工作流** | 节点拓扑、连线、`FlowNodeData` 骨架（默认无 `path`/`assetId`） | 手动搭管线、跨 Tab 复用 |
| **分组模板**（已有） | 带 `group` 外壳的子图快照 `CanvasGroupTemplateV1` | `saveGroupToToolbox` → `LeftAddDock` 工具箱 |
| **Hermes 计划模板**（已有） | `toolId` 步骤列表 | 灵体对话自动跑片 |

**本轮统一用户心智**：对外只称 **「工作流」**；保存分组 = 工作流的一种（可含 group 外壳）。现有「添加到工具箱」文案逐步改为「保存为工作流」。

**数据格式（规划）**：`CanvasWorkflowSnapshotV1` — 与 `src/lib/canvasGroupTemplate.ts` 的 `CanvasGroupTemplateV1` 同族，支持：

- `version: 1`
- `id`, `name`, `createdAt`, `description?`, `tags?`
- `nodes[]`（`localId`, `type`, `position`, `data`, 可选 `parentId`）
- `edges[]`（`sourceLocalId`, `targetLocalId`, handles）
- 可选 `group` 块（与现有分组模板兼容）

插入时：新 UUID、`normalizeGroupNodesForCanvas`、`sanitizeCanvasEdges`、节点 counter 续号（与 `insertGroupTemplate` / 粘贴一致）。

---

## 1) 本轮目标（一句话）

交付 **本机工作流库 + 任意选区保存 + 跨 Tab/跨工程插入**，使用户在画布 A 保存的片段可在画布 B 复用，且默认不携带工程内媒体路径与密钥。

---

## 2) 变更范围（最多 3 个模块）

| 模块 | 路径 / 产物 | 本轮动作 |
|------|-------------|----------|
| **A. 工作流快照与存储** | `src/lib/canvasWorkflowSnapshot.ts`（新建，可复用 `canvasGroupTemplate` 的 sanitize / 映射）；Tauri：`app_data/workflows/` 或等价命令；浏览器：`localStorage` 降级 | 保存/加载/列表/删除 API；与 `CanvasGroupTemplateV1` 互转或共享构建函数 |
| **B. 工程 store 与插入** | `src/store/projectStore.ts`：`saveWorkflowFromSelection`、`insertWorkflow`；`recordBeforeDiscreteMutation` | 视口中心落点；插入后选中根 group 或首节点 |
| **C. 画布 UI** | `src/components/canvas/CanvasWorkflowLibrarySection.tsx`；`LeftAddDock.tsx`；`MultiSelectionToolbar.tsx`；可选 `GroupToolbar` 文案 | 「工作流」列表区；保存对话框（名称 + 保存位置仅「本机库」） |

---

## 3) 功能清单（2～4 项）

| ID | 说明 |
|----|------|
| **WF96-1** | **保存工作流**：框选 ≥1 个节点（含组内成员，逻辑对齐 `copySelection` 子树收集）→ 对话框填名称 → 写入本机库 |
| **WF96-2** | **工作流库面板**：`LeftAddDock`「工作流」区：列表、搜索、插入、删除；来源标签「本机 / 工程」 |
| **WF96-3** | **跨画布插入**：Tab / 工程切换后仍可插入；视口中心落点 |
| **WF96-4** | **双库保存**：对话框可同时勾选 **本机**（`localStorage`）与 **当前工程**（`.canvasflow/workflows/*.json`） |
| **WF96-5** | **sanitize**：去掉 `path`/`assetId`/运行态与敏感 `params` 键 |

---

## 4) 非目标（本轮不做）

- 单文件 **导入/导出** JSON、zip 工作流包（→ iter-97）
- 列表 **缩略图**、标签分类、最近使用排序（→ iter-98）
- 插入前 **落点选项**（鼠标/选中节点右侧）、模型缺失黄标（→ iter-97）
- 「含媒体路径」保存策略、插入时自动拷贝 `assets/`（→ 后续专轮）
- 与 Hermes 计划模板互转、保存后自动生成 Director Plan（→ iter-98）
- 云端同步、团队共享库
- 替换或删除现有分组工具箱（本轮可并存；文案可统一为「工作流」）

---

## 5) 验收步骤（手工）

### 桌面（`npm run tauri dev`，P0）

1. 打开工程，框选「文本 → 图片 → 视频」三节点（或任意已连线子图），多选工具条点 **「保存为工作流」**，命名 `测试链路`，确认状态栏成功。  
2. 打开 **添加 → 工作流**，列表可见 `测试链路`，显示节点数/边数。  
3. **新建画布 Tab**（或临时画布、无工程路径），从工作流库 **插入**，三节点与连线出现在视口中心附近，可拖拽，**Ctrl+Z** 可撤销。  
4. **再开一个工程目录**，重复步骤 3，仍能插入同一条本机工作流（验证跨工程）。  
5. 删除库中一条工作流，列表消失；再插入应提示不存在。  
6. 保存后检查节点无 `path`/`assetId`（选中节点 Inspector 或导出 JSON 快照）：仅结构与参数骨架。

### 浏览器预览（降级）

7. 无 Tauri 时：保存写入 `localStorage`，插入仍可用；列表刷新无报错。

### 自动化（建议实施轮补齐）

8. Vitest：`canvasWorkflowSnapshot`  round-trip（保存字段 strip、ID 重映射）。  
9. 可选 E2E：保存 → 新 Tab 插入 → `.react-flow__node` 数量增加（非本轮 DoD 硬门槛，可跟 iter-97）。

---

## 6) UI/UX

> 详见 [`UI_ITERATION_GUIDE.md`](../design/UI_ITERATION_GUIDE.md)。

### 关键界面

| 界面 | 变更 |
|------|------|
| **多选工具条** `MultiSelectionToolbar.tsx` | 新增「保存为工作流…」（图标+文字，与「打组」并列） |
| **左侧添加 Dock** `LeftAddDock.tsx` | 新增折叠区 **「工作流」**（与节点类型、工具箱并列）；列表行：名称、副标题「N 节点 · M 连线」 |
| **保存对话框** | 模态或轻量 `ConfirmDialog` 风格：名称输入框；说明「保存到本机，可在任意画布插入」 |
| **分组工具条**（可选本轮） | 「添加到工具箱」改为「保存为工作流」或保留双文案指向同一 API |

### 关键状态

| 状态 | 表现 |
|------|------|
| 空库 | 「暂无工作流。框选节点后点「保存为工作流」。」 |
| 加载中 | 列表区「正在加载工作流…」 |
| 保存成功 | 顶栏/状态栏：`已保存工作流：{name}` |
| 插入成功 | `已插入工作流：{name}`；选中插入的根节点或 group |
| 失败 | 可读错误（重名覆盖策略：同名则覆盖并提示） |

### 键盘与焦点

- 保存对话框：`Enter` 确认、`Esc` 取消；不占用画布 `Tab`（添加节点）快捷键。  
- 工作流列表行：`Enter` 等同点击插入（可选 P1）。

### 本轮 UI 非目标

- 不改画布配色 token、不新增 Inspector 侧栏。  
- 不做工作流预览画布缩略图。

---

## 7) 风险与回退

| 项 | 说明 |
|----|------|
| **主要风险** | 插入后 `providerId`/模型在当前设置不存在，用户困惑；大子图插入性能卡顿 |
| **触发条件** | 插入后连线校验失败、撤销栈异常、本机库 JSON 损坏导致列表为空 |
| **回退动作** | 删除 `canvasWorkflowSnapshot.ts`、Dock 工作流区、store 方法；恢复工具条；清除 `app_data/workflows` 或 localStorage key |
| **保留信息** | 失败时导出问题工作流 JSON；`canvasflow.json` 不受影响 |

**缓解（实施时注意）**：

- 插入走与 `insertGroupTemplate` 相同的 `normalizeGroupNodesForCanvas` + `sanitizeCanvasEdges`。  
- 单条工作流节点数软上限（如 200）超出时拒绝保存并提示。  
- 本机库与现有 `canvasflow.groupTemplates.v1` **分 key 存储**，避免互相覆盖。

---

## 8) 完成定义（DoD）

- [x] WF96-1～WF96-5 已合并 `feat/hermes-p2-agent-experience`（`573f21d` 起含 A+B+C）
- [x] `npm run typecheck`、Vitest `canvasWorkflowSnapshot.test.ts`（4/4）、`cargo test --lib` 已通过
- [x] `CURRENT_PROGRESS.md` §4/§7 已更新
- [ ] §5 桌面手工验收（需本地 `npm run tauri dev`）
- [ ] 远程 PR 栈推送与 `gh pr create`（网络可用时执行下方命令）

---

## 9) 关键代码索引（实施时对照）

| 主题 | 现有路径 | 本轮新增/扩展 |
|------|----------|----------------|
| 分组模板快照 | `src/lib/canvasGroupTemplate.ts` | 抽象为工作流快照或 re-export |
| 保存/插入分组 | `src/store/projectGroupProduction.ts` | `saveWorkflowFromSelection` / `insertWorkflow` |
| 工具箱 UI | `src/components/canvas/CanvasGroupToolboxSection.tsx` | 参考列表 UX；新 `CanvasWorkflowLibrarySection` |
| 多选工具条 | `src/components/canvas/MultiSelectionToolbar.tsx` | 保存入口 |
| 粘贴/ID 映射 | `src/lib/buildPasteNodesFromClipboard.ts` | 复用子树与边重建逻辑 |
| 工程载入 sanitize | `src/lib/projectWorkspaceLoad.ts` `prepareCanvasGraph` | 插入后同标准 |

---

## 10) 后续迭代（已规划，非 iter-96）

### iter-97 · 工作流库 P1（工程库 + 导入导出 + 插入选项）

| 项 | 内容 |
|----|------|
| **目标** | 工作流可随工程 Git 共享；单文件迁移；插入体验可配置 |
| **功能** | `.canvasflow/workflows/*.json`；设置/工作流库「导入」「导出」；插入落点（视口中心/鼠标）；模型缺失状态栏提示 |
| **非目标** | 缩略图、Hermes 联动 |

### iter-98 · 工作流库 P2（体验与智能化）

| 项 | 内容 |
|----|------|
| **目标** | 库可检索、可预览，与自动化生产区分更清晰 |
| **功能** | 标签（分镜/首尾帧/配音）；列表缩略图（类型图标拼图）；「最近使用」；整组执行成功后「保存为本工作流」提示 |
| **非目标** | 云端库、自动跑片 |

---

## 11) 与 Hermes / 生产流关系（说明用）

- 用户说「保存工作流」指 **画布拓扑**，不是 `iteration-38` 的计划模板。  
- 文档与 UI 中避免仅用「模板」一词指画布片段；推荐 **「工作流」** / **「工作流库」**。  
- 灵体「套用模板跑片」仍指 Hermes Director 步骤，与 iter-96 无代码耦合。

---

*实施前若调整范围（例如 P0 同时做工程内库），请先修订本节 §2～§4 并拆分 iter-97，保持单轮单目标。*
