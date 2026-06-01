# iter-95 · 黄金路径 P0/P1 巩固

> **层**：资产与质量层（AssetAndQualityLayer）  
> **真源**：[`docs/product/GOLDEN_PATH.md`](../product/GOLDEN_PATH.md) · [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md)  
> **状态**：**已完成**（2026-05-26）  
> **更新**：2026-05-26

---

## 1) 本轮目标（一句话）

按黄金路径 **10 步** 收敛 **P0/P1** 验收基线：A 档自动化可绿、B 档桌面「能创作 / 能保存 / 能导出」可勾选，并冻结与 `GOLDEN_PATH` 不一致的文档表述。

---

## 2) 变更范围（最多 3 个模块）

| 模块 | 路径 / 产物 | 本轮动作（规划） |
|------|-------------|------------------|
| **A. 黄金路径与发布清单** | `docs/product/GOLDEN_PATH.md`、`RELEASE_CHECKLIST.md` | 为每步标注 P0/P1、自动化覆盖、无 Key 降级路径 |
| **B. 自动化冒烟** | `e2e/golden-path.spec.ts`；`projectStore.goldenPath.test.ts`、`canvasTabSync.test.ts`、`buildFromScript.test.ts` | 列 P0 缺口用例（见 §3.1）；实施轮再补代码 |
| **C. 进度真源对齐** | `docs/iterations/CURRENT_PROGRESS.md` §5/§6、`docs/product/PRODUCT_STATUS_MATRIX.md` | 修正与黄金路径冲突的表述（如轮询 stub、门禁命令） |

---

## 3) 功能清单（仅 P0 / P1）

### 3.0 黄金路径步骤 ↔ 优先级对照

| 步骤 | GOLDEN_PATH 段 | 优先级 | 自动化现状 | 本轮 P0/P1 意图 |
|------|------------------|--------|------------|-----------------|
| **1** | A 启动 | **P0** | 无 E2E | 浏览器点「新建工程」→ 需桌面壳提示，**不崩溃** |
| **2** | A 工程 | **P0** | 无（仅桌面） | 新建/打开目录；顶栏路径；图库由灰变可点 |
| **3** | A 未保存标记 | **P0** | ✅ `golden-path` 第 1 条 | 维持绿；改 Tab/保存逻辑时必跑 |
| **4** | B 脚本落画布 | **P0** | ✅ `golden-path` 第 2 条 | 维持绿；`MinimalScriptNode` Chrome 可见 |
| **5** | B 脚本内容 | **P1** | 无（需 LLM + 桌面） | 已配 Key 时：≥1 `scriptBeats` 且非永久失败 |
| **6** | B 视频节点 | **P1** | 无 | 面板分组 + **状态轨在参数区上方**（R5）；无 Key 只验 UI |
| **7** | C 剪辑台 | **P0** | ✅ `golden-path` 第 3 条 | 单击合成节点 → 全屏剪辑；Esc/关闭退出 |
| **8** | C 从脚本填充 | **P1** | 单测 `buildFromScript`（局部） | 桌面：连线 + 可解析路径 → 镜序与条数一致或策略提示 |
| **9** | C 导出成片 | **P0** | 无（仅桌面） | 导出成功 → 节点 `path`/`assetId` 或可读错误 |
| **10** | C 持久化 | **P0** | 无（仅桌面） | `Ctrl+S` / 顶栏保存 → 重开工程节点与连线仍在 |

**P0 定义（本轮）**：阻断 A 档合入、或阻断 B 档「三能」声明（创作入口 / 保存 / 导出）的步骤 **1、2、3、4、7、9、10**，以及 **`npm run quality:gate`** / **`npm run release:check`**。  
**P1 定义（本轮）**：不挡 A 档，但发版 B 档应勾选或明确「无 Key 降级」的步骤 **5、6、8**，以及 **Tab 切换快验**（见 `RELEASE_CHECKLIST` B 档）。

---

### 3.1 功能点（2～4 项，均可验收）

| ID | 级别 | 说明 |
|----|------|------|
| **GP95-P0-a** | P0 | **A 档门禁**：`npm run quality:gate` 与 `npm run release:check` 在干净环境可重复通过（含 `test:e2e:golden` 3 条） |
| **GP95-P0-b** | P0 | **浏览器 P0 冒烟扩展（规划）**：步骤 1「新建工程」不崩溃 + 提示文案可见（可选补 E2E，与 iter-19 并列维护） |
| **GP95-P0-c** | P0 | **桌面 P0 清单**：步骤 2、9、10 写入 B 档勾选说明，与 `GOLDEN_PATH` 逐步对齐（无新 UI 面） |
| **GP95-P1-a** | P1 | **生产链 B 档**：步骤 5～6、8 的「有 Key / 无 Key」双路径验收说明写进 `GOLDEN_PATH` 或链到 `RELEASE_CHECKLIST` |
| **GP95-P1-b** | P1 | **Tab 快验**：两标签各加不同节点，切换不串（已有 `canvasTabSync.test.ts`，B 档 30 秒步骤保留） |
| **GP95-P1-c** | P1 | **文档漂移**：`CURRENT_PROGRESS` §5 与 iter-87 一致——`poll_video_job_http` 已接 HTTP，仅 `mock_` job 降级 |

> **实施轮建议顺序**：GP95-P0-a → GP95-P0-b → GP95-P0-c → GP95-P1-a → GP95-P1-b → GP95-P1-c（仍遵守单轮单目标时可拆为 95a/95b）。

---

## 4) 非目标（本轮不做）

与 [`GOLDEN_PATH.md`](../product/GOLDEN_PATH.md)「明确不在此路径内」一致，并额外冻结：

- 资产 ID 纵轴 M5（删 `path`、新 reconcile 策略）
- LibTV 式底部生成器 Dock、运行时挂载 `Inspector` 作主编辑壳
- R6 多轨 / 转场（iter-18 已冻结）
- 新 Provider、大规模换皮、Hermes iter-86+ 新 Tool、阶段 5 Epic（E2 参考视频理解等）
- Tauri 桌面全链路 E2E、FFmpeg 真导出自动化（仍属 iter-19 非目标）
- **P2+ 工程债**：`global.css` 拆分、`ScriptNodeWorkbench` 拆文件（见 `CURRENT_PROGRESS` §6 P1 维护项，不并入 iter-95）

---

## 5) 验收步骤（手工，对应 GOLDEN_PATH）

### A 档（自动化，P0）

1. `npm run test:e2e:install`（首次）  
2. `npm run release:check` → typecheck、lint、覆盖率 Vitest、Rust、`test:e2e:golden` 全绿  
3. `npm run test -- src/store/projectStore.goldenPath.test.ts src/lib/canvasTabSync.test.ts src/lib/compose/buildFromScript.test.ts` 全绿  

### B 档（桌面 `npm run tauri dev`，P0 + P1）

4. **P0 · 步骤 1～2**：新建或打开工程；浏览器仅验步骤 1 提示不崩溃  
5. **P0 · 步骤 3～4、7**：未保存点；脚本节点；合成节点打开/关闭剪辑台（可与 A 档 E2E 对照）  
6. **P1 · 步骤 5～6**（已配 LLM/视频 Key）：至少 1 镜；视频面板与状态轨位置正确；**无 Key** 时只验步骤 6 UI  
7. **P0 · 步骤 9～10**：导出成片或可读错误；保存后重开工程图仍在  
8. **P1 · 步骤 8**：脚本—视频—合成已连线且有路径时，「从脚本镜头填充」镜序一致  
9. **P1 · Tab 快验**：按 `RELEASE_CHECKLIST` B 档「Tab 切换快验」30 秒走一遍  

---

## 6) UI/UX

- **本轮无新 UI 功能**；仅验收既有入口是否符合 `GOLDEN_PATH` 描述。  
- **关键界面**：顶栏工程/保存/标签；`LeftAddDock`；`MinimalScriptNode`；`ComposeEditorOverlay`；视频节点多模态底栏（R5 状态轨在参数区**上方**）。  
- **关键状态**：无工程 / 未保存 / 剪辑台打开 / 导出失败（可读 `title` 或 toast）；浏览器「新建工程」禁用态提示。  
- **本轮 UI 非目标**：不改配色 token、不增 Inspector 侧栏、不改剪辑台 IA。

---

## 7) 风险与回退

| 项 | 内容 |
|----|------|
| **主要风险** | 仅补 E2E 仍无法覆盖桌面 IO/FFmpeg，B 档 P0 依赖人工；文档与实现再次漂移 |
| **触发条件** | `release:check` 失败；B 档步骤 9/10 必现失败；Tab 切换串图；浏览器新建工程崩溃 |
| **回退动作** | 还原本轮改动的 `golden-path.spec.ts`、清单文档；实施轮若动 `vitest.config` 覆盖率策略则一并回退 |
| **保留信息** | 失败截图、`npm run release:check` 完整日志、工程目录样本（脱敏 Key）、`assets/` 与 `canvasflow.json` 片段 |

---

## 8) 完成定义（DoD）

- [x] §3.0 表中 **P0** 浏览器可自动化项：E2E 4 条 + `quality:gate`（步骤 2/9/10 仍 B 档手工）  
- [x] §3.0 **P1**：`GOLDEN_PATH` 双路径表 + B 档勾选说明（步骤 5～6/8、Tab 快验）  
- [x] `GOLDEN_PATH` / `RELEASE_CHECKLIST` / `CURRENT_PROGRESS` 交叉链接一致  
- [x] 未引入 §4 非目标范围内的代码或 UI 面  
- [x] `e2e/golden-path.spec.ts` 新增步骤 1 冒烟（GP95-P0-b）

### 交付摘要

| ID | 交付物 |
|----|--------|
| GP95-P0-a | 维持 `quality:gate` / `release:check` 可跑（见当轮 CI 日志） |
| GP95-P0-b | `golden-path` 第 4 条：浏览器新建工程 → 桌面壳提示 |
| GP95-P0-c | `RELEASE_CHECKLIST` B 档 P0 步骤 2/9/10 勾选说明 |
| GP95-P1-a | `GOLDEN_PATH`「有 Key / 无 Key」表 |
| GP95-P1-b | Tab 快验链保留 + `canvasTabSync.test.ts` |
| GP95-P1-c | `CURRENT_PROGRESS` §6 轮询表述（iter-87） |

---

## 9) 入口索引

| 类型 | 路径 |
|------|------|
| 手工 10 步 | [`docs/product/GOLDEN_PATH.md`](../product/GOLDEN_PATH.md) |
| A/B/C 档 | [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md) |
| E2E | [`e2e/golden-path.spec.ts`](../../e2e/golden-path.spec.ts) |
| 监控基线 | [`iteration-19-maturity-monitoring.md`](iteration-19-maturity-monitoring.md) |
| 合成 P3 | [`iteration-18-p3-timeline-export.md`](iteration-18-p3-timeline-export.md) |
| 产品矩阵 | [`docs/product/PRODUCT_STATUS_MATRIX.md`](../product/PRODUCT_STATUS_MATRIX.md) |

---

## 10) 与前后迭代关系

| 迭代 | 关系 |
|------|------|
| **iter-19** | 建立 10 步文档 + 3 条 E2E；iter-95 **不重复造文档**，只补 P0/P1 缺口表 |
| **iter-90～94** | R5 测试连接、E5 批量/重试、连线删除等 **不在** iter-95 范围，除非 B 档验收暴露回归 |
| **iter-96+（建议）** | 实施 **GP95-P0-b**（E2E 步骤 1）、可选桌面验收记录模板；Epic / Hermes 另开 iter |
