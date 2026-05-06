# Milestone M1：任务清单（可转为 GitHub Issues）

**目标（来自 [development-plan.md](./development-plan.md)）**：新导入素材具备稳定 **asset id**，索引与预览链路可优先走 **id**；**部分**元数据写入 `meta_json`（A.1 + A.3 部分）。

**建议标签**：`milestone:M1` `area:assets` `area:tauri` `area:frontend`

**依赖顺序**：按下方 **Phase 0 → 3** 顺序排期；同 Phase 内可并行标注「可并行」。

---

## Phase 0：契约与迁移设计（0.5～1 天）

### Issue M1-0.1 — 定义 `asset_id` 与 JSON 兼容策略

- **类型**：`docs` / `spike`
- **描述**：
  - 约定：`asset_id` 使用 **UUID v4**（或 ULID）字符串，全局在**单工程**内唯一（首期可不做跨工程合并）。
  - 约定：`FlowNodeData.path` 在迁移期保留；新增可选字段 `assetId?: string`（或 `primaryAssetId`），与 `path` 二选一优先或双写策略写进 ADR 式短文（可放在本文件「附录」或 `docs/design/` 下短文档）。
- **验收**：
  - [ ] 团队对齐「读路径：优先 assetId → 解析为 rel_path → 回退 path」规则。
  - [ ] 旧工程无 `assetId` 时行为与现网一致（仍用 `path`）。
- **产出**：1 页设计说明（可合并进 PR 描述）。

---

## Phase 1：数据库与 Rust API（1～2 天）

### Issue M1-1.1 — DB：`assets` 表增加 `asset_id` 与迁移

- **类型**：`backend`
- **描述**：
  - 在 `.canvasflow/runs.db` 使用的同一 DB 连接中扩展 `assets` 表（或迁移脚本）：新增列 `asset_id TEXT UNIQUE`。
  - 已有行：为每条生成 UUID 并回填（一次性迁移）。
  - 新唯一约束：`rel_path` 仍 UNIQUE；`asset_id` UNIQUE NOT NULL（迁移后）。
- **验收**：
  - [ ] 打开旧工程执行迁移后无报错；`list_assets` 仍能列出。
  - [ ] 新插入行必须带 `asset_id`。
- **涉及文件**：`src-tauri/src/db.rs`（`init_schema` / 迁移逻辑）

### Issue M1-1.2 — Rust：`upsert_asset` / `get_asset_by_id` / `get_asset_by_rel_path`

- **类型**：`backend`
- **描述**：
  - `upsert_asset`：写入时若未传 `asset_id` 则生成新 UUID。
  - `get_asset_by_id(project_root, asset_id) -> Option<AssetRecord>`，返回 `rel_path`、`media_type`、`meta_json` 等。
  - `get_asset_by_rel_path`：便于双写期与旧代码兼容。
- **验收**：
  - [ ] 单元测试或最小集成测试：插入 → 按 id 读出 → `rel_path` 一致。
- **涉及文件**：`src-tauri/src/db.rs`、`src-tauri/src/lib.rs`（如需 expose command）

### Issue M1-1.3 — Tauri Commands：`import_media_files` 返回值扩展

- **类型**：`backend` + `breaking`（注意前端同步）
- **描述**：
  - 当前：`import_media_files` 返回 `Vec<String>`（相对路径）。
  - 目标：返回结构化结果，例如 `Array<{ assetId: string, relPath: string }>`，或保留旧 command、新增 `import_media_files_v2`（推荐**直接改返回值**并一次改全前端调用，减少双轨）。
  - 导入流程：拷贝文件 → `upsert_asset`（生成/携带 asset_id）→ 返回 id + path。
- **验收**：
  - [ ] 画布拖入/选文件导入后，前端能拿到 `assetId`。
  - [ ] `sync_assets_index` 扫描入库时为每条生成 `asset_id`（若尚无）。
- **涉及文件**：`src-tauri/src/lib.rs`（`import_media_files`、`sync_assets_index`）

---

## Phase 2：元数据最小集（A.3 部分）（1～2 天）

### Issue M1-2.1 — 图片：宽高写入 `meta_json`

- **类型**：`backend`
- **描述**：
  - 在 `upsert_asset` 前或后，对 `media_type == image` 的文件解码头部或依赖轻量 crate 读取宽高。
  - `meta_json` 建议结构：`{ "width": n, "height": n, "version": 1 }`（字段名团队可微调，需与前端类型一致）。
- **验收**：
  - [ ] 新导入 PNG/JPEG/WebP 在 DB 中 `meta_json` 非空且含宽高。
  - [ ] 超大图注意性能：可限制只读头部或异步写入（二期优化，M1 可同步阻塞导入）。
- **涉及文件**：`src-tauri/src/media.rs`（若已有）或新建 `src-tauri/src/asset_meta.rs`

### Issue M1-2.2 — 音视频：时长（及可选宽高）写入 `meta_json`

- **类型**：`backend`
- **描述**：
  - 调用 `ffprobe`（与设置中 `ffmpeg_path` 同目录或可配置 `ffprobe` 路径）解析 `duration_sec`，视频可选 `width`/`height`。
  - 失败时：`meta_json` 可为空或仅 `{ "probeError": "..." }`，不阻断导入。
- **验收**：
  - [ ] 样例 mp4/mp3 导入后 `meta_json` 含 `durationSec`（或统一 snake_case 与前端 parse）。
- **涉及文件**：同上；`settings.rs` 如需 `ffprobe_path`

---

## Phase 3：前端接入与预览走 id（1～2 天）

### Issue M1-3.1 — `FlowNodeData` 与 `assignImportedMediaToNode`

- **类型**：`frontend`
- **描述**：
  - `src/lib/types.ts`：`FlowNodeData` 增加可选 `assetId?: string`。
  - `projectStore.assignImportedMediaToNode` / `importMediaFiles`：在拿到导入结果后，对节点 `updateNodeData` 写入 `assetId` + `path`（双写）。
- **验收**：
  - [ ] 保存 `canvasflow.json` 后可见 `assetId` 字段（若已导入）。
  - [ ] 未走导入 API 的旧节点仍只有 `path`。
- **涉及文件**：`src/lib/types.ts`、`src/store/projectStore.ts`

### Issue M1-3.2 — `NodeMediaPreview` / 资产解析：优先 `assetId`

- **类型**：`frontend`
- **描述**：
  - 若 `data.assetId` 存在：调用新 command `resolve_asset_path(projectPath, assetId)`（或启动时批量拉取映射缓存），得到 `rel_path` 再交给现有预览组件。
  - 若无 `assetId`：沿用 `path`。
- **验收**：
  - [ ] 图片/视频/音频节点在仅有 `assetId` 时仍能预览（可先手写 JSON 测）。
  - [ ] 不增加明显首屏阻塞（可接受 M1 同步 invoke）。
- **涉及文件**：`src/components/nodes/NodeMediaPreview.tsx`、相关 hooks、`src-tauri/src/lib.rs`

### Issue M1-3.3 — 画廊与素材列表 API 对齐

- **类型**：`frontend`
- **描述**：
  - `listAssets` / 画廊 UI：展示 `assetId`（可折叠或开发者模式），排序仍以时间为主。
  - `AssetSummary` TS 类型增加 `assetId` 字段（与 Rust `AssetSummary` 同步）。
- **验收**：
  - [ ] 素材列表与导入结果 id 一致。
- **涉及文件**：`src/shared/api/assets.ts`、`src/components/canvas/CanvasContextMenus.tsx`（若展示列表）、调用 `list_assets` 处

---

## Phase 4：验收与收尾（0.5 天）

### Issue M1-4.1 — 手工验收清单（QA）

**状态**：**已收尾**（2026-04-21）。签字与结论见 [`milestone-M1-qa.md`](./milestone-M1-qa.md)「验收签字」「M1-4.1 收尾结论」。

**已交付**：分步说明、SQL 与签字表见 [`milestone-M1-qa.md`](./milestone-M1-qa.md)；**自动化**为 `src-tauri` 下 `cargo test`（`db.rs`：`asset_id` 迁移回填、`upsert`/`list`、`get_by_id`/`get_by_rel_path`）。

**验收**

- [x] 新建工程 → 拖入 1 张图、1 段视频、1 段音频 → DB/JSON 中均有 `assetId`。
- [x] 关闭重开工程 → 预览仍正常（id 解析成功）。
- [x] 旧工程（无 assetId）打开 → 不崩溃，预览仍走 path。
- [x] `sync_assets_index` 后旧文件全部有 `assetId`。

### Issue M1-4.2 — 更新对照表与开发计划

- **类型**：`chore`
- **状态**：**已完成**（与 M1 收尾一并核对）：[`architecture-spec-vs-implementation.md`](./architecture-spec-vs-implementation.md) 资产/元数据行已更新为 M1 现状；[`development-plan.md`](./development-plan.md) 中 M1 已打 ✅ 并链至本清单。
- **描述**：在 [`architecture-spec-vs-implementation.md`](./architecture-spec-vs-implementation.md) 中将「资产 ID / 元数据」行从 ❌/⚠️ 更新为 M1 达成状态；[`development-plan.md`](./development-plan.md) 中 M1 行打勾或链接本清单。

---

## 汇总表（便于建 Board）

| ID | 标题 | Phase | 预估 |
|----|------|-------|------|
| M1-0.1 | 契约：assetId 与双写策略 | 0 | 0.5d |
| M1-1.1 | DB 迁移 asset_id | 1 | 0.5d |
| M1-1.2 | db 查询 by id / by path | 1 | 0.5d |
| M1-1.3 | import 返回 assetId + path | 1 | 1d |
| M1-2.1 | 图片 meta 宽高 | 2 | 1d |
| M1-2.2 | 音视频 meta 时长 | 2 | 1d |
| M1-3.1 | FlowNodeData + store 双写 | 3 | 0.5d |
| M1-3.2 | 预览解析优先 assetId | 3 | 1d |
| M1-3.3 | listAssets 类型与 UI | 3 | 0.5d |
| M1-4.1 | QA 清单执行 | 4 | 0.5d ✅ |
| M1-4.2 | 文档更新 | 4 | 0.25d ✅ |

**粗算**：约 **5～8 人日**（视 ffprobe/图片探针环境与测试覆盖浮动）。

---

## 附录：建议的 Issue 模板（复制到 GitHub）

```markdown
## 背景
Milestone M1：资产 ID + 部分元数据 — 见 `docs/design/milestone-M1-issues.md`

## 任务
<!-- 简述 -->

## 验收标准
- [ ] 

## 涉及路径
- 
```

---

## 相关文档

- [development-plan.md](./development-plan.md)
- [architecture-spec-vs-implementation.md](./architecture-spec-vs-implementation.md)
