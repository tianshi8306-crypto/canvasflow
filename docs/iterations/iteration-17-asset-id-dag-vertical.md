# 迭代 17 — 资产 ID 纵轴（M2～M4，已冻结）

> 层：**ProviderOrchestrationLayer** + **AssetAndQualityLayer**  
> 对照：[`architecture-spec-vs-implementation.md`](../design/architecture-spec-vs-implementation.md) §1.3  
> 更新：**2026-05-21**

## 0) 决策（单人开发，够用即止）

**状态：已冻结，不再扩展 M5+。**

日常只需遵守三条，不必再改资产纵轴代码：

1. 生成/导入写节点：`commitNodeMediaPatch(relPath, assetId)`（`src/lib/nodeMediaRef.ts`）
2. 读路径：`resolveAssetRelPath` / `resolveNodeMediaRelPath`（优先 `assetId`）
3. 打开工程：已有 `backfill_canvas_asset_ids` 自动 reconcile，有补丁即未保存

**不做的**：从 `canvasflow.json` 删除 `path`、边上只传 ID、为纵轴加新命令。M3/M4 已落地，当作基建；除非旧工程打开/预览/生成出 bug，否则不回滚也不加厚。

## 1) 本轮目标（一句话）

旧工程与 DAG 执行在媒体节点上**统一 `assetId` 真源**：索引可查、打开工程自动回填、执行日志带 ID。

## 2) 变更范围

- Rust：`canvas_asset_backfill.rs`、`asset_resolve` 扩展、`shared` 执行日志
- 前端：`nodeMediaRef.ts`、`projectWorkspaceLoad` 打开时回填
- Tauri 命令：`backfill_canvas_asset_ids`

## 3) 功能清单（M2）

| 项 | 说明 |
|----|------|
| M2-1 | `resolve_node_media_asset_id`：从 `assetId` 或 `path`→索引解析 |
| M2-2 | 打开工程：仅有 `path` 的媒体节点 `upsert` 后写回 `assetId`，并标未保存 |
| M2-3 | DAG 执行 `asset` / `node_output` 事件含 `assetId` |
| M2-4 | 前端 `hasNodeMedia` / `nodeMediaRef` 共享语义 |

## 4) M3 功能清单（2026-05-21）

| 项 | 说明 |
|----|------|
| M3-1 | 媒体节点 DAG `outputs` 写入 `{"relPath","assetId"}` JSON（无 ID 时仍裸路径） |
| M3-2 | `recover_run_outputs` 从 `node_output` 事件恢复 JSON 条目 |
| M3-3 | 打开工程回填 `storyboardShots[].imageAssetId` 与 `scriptBeats` 角色图 ID |
| M3-4 | 图片写回分镜时同步 `imageAssetId`；前端 `parseNodeMediaOutput` |

## 5) M4 功能清单（2026-05-21）

| 项 | 说明 |
|----|------|
| M4-1 | `reconcile_graph_media_nodes`：有 `assetId` 时以索引 `rel_path` 纠正/补全 `path` |
| M4-2 | 脚本分镜/角色图：有 `*AssetId` 时同步 `*ImagePath` / `imagePath` |
| M4-3 | 打开工程写回补丁同时更新 `path` + `assetId` |
| M4-4 | `commitNodeMediaPatch` / `resolveNodeMediaRelPath` 前端双写约定 |

**仍保留**节点 `path` 字段（派生缓存，未删除）；解析与执行器已优先 `assetId`。

## 6) 非目标（M5+）

- 边上传输**仅** assetId（文本类 output 仍为字符串）
- 从 JSON 序列化中移除 `path`
- 强类型端口、并行调度、断点续跑

## 7) 验收步骤（M2～M4）

1. 用仅含 `path`、无 `assetId` 的旧 `canvasflow.json` 打开工程 → 状态栏提示「已补全 N 个素材 ID」，节点 data 出现 `assetId`，顶栏未保存。
2. 保存后重开 → 不再重复补全（已有 `assetId`）。
3. `runs.db` 中 `assets` 表存在对应 `rel_path` / `asset_id`。
4. 运行含图片/视频节点的 DAG → `run_events` 中 `asset` 与 `node_output` 含 `assetId` 字段。
5. `cargo test canvas_asset_backfill` / `asset_resolve` 单元测试通过。
6. 旧工程 `storyboardShots` 仅有 `imagePath` → 打开后含 `imageAssetId`。
7. 有 `assetId` 的图片节点跑 DAG → `outputs` 映射值为 JSON（见 `node_output.rs`）。
8. 节点仅有 `assetId`、无 `path`（或 path 过期）→ 打开工程后 `path` 与索引一致，标未保存。

## 8) 迁移策略

| 阶段 | 行为 |
|------|------|
| **双写期（当前）** | 生成/导入同时写 `path` + `assetId`；解析优先 `assetId` |
| **打开回填** | Tauri 下 `backfill_canvas_asset_ids`，仅补缺、不改已有 ID |
| **M3（当前）** | DAG outputs JSON；脚本分镜/角色图 assetId 回填；写回分镜带 ID |
| **M4（当前）** | `assetId` 真源；`path` 由索引派生并双写；打开工程双向 reconcile |
| **M5** | 可选从持久化 JSON 移除裸 `path`（需 major 版本） |

旧工程兼容：无 `runs.db` 时 `ensure_project_structure` 会创建；`path` 文件不存在则跳过该节点。

## 9) 风险与回退

- **风险**：回填后用户未保存即关闭，下次仍回填（幂等，无重复 ID 问题）
- **回退**：移除 `applyAssetIdBackfill` 调用与命令注册；保留 `resolve_*` 不影响旧行为

## 10) 完成定义

- M2 功能清单 1～4 验收通过
- `npm run typecheck`、`npm run test`、`cargo test` 相关模块通过
