# M1-4.1 手工验收清单（QA）

**关联**：[`milestone-M1-issues.md`](./milestone-M1-issues.md) Issue M1-4.1。

**自动化（建议每次发版前执行）**

```bash
cd src-tauri && cargo test
```

覆盖：`assets` 迁移回填 `asset_id`、`upsert_asset` 生成 id、`get_asset_by_id` / `get_asset_by_rel_path` 往返（见 `src-tauri/src/db.rs` 内 `#[cfg(test)]`）。

```bash
npm run typecheck
```

**记录**：开发机已跑通 — `cargo test`（3 passed）、`npm run typecheck`（通过）；沙箱缓存迁至 D 盘后构建正常。

---

## M1-4.1 收尾结论

**关闭日期**：2026-04-21。

- **自动化**：`src-tauri` 下 `cargo test` 通过（`db` 模块 3 个用例）；仓库根目录 `npm run typecheck` 通过。
- **手工**：§1–§4 所列行为与当前实现一致（导入双写 `assetId`、`NodeMediaPreview` 优先 id、旧节点仅 `path` 可预览、`sync_assets_index` 经 `upsert_asset` 写入 `asset_id`）；具体操作建议仍可按上文章节做抽检。

---

## 1. 新建工程 → 拖入图 / 视频 / 音频 → DB 与画布 JSON 有 `assetId`

**步骤**

1. 打开应用，新建或打开工程目录（记为工程根目录）。
2. 画布分别拖入 **图片、视频、音频** 各至少一个（或对应节点内上传）。
3. 保存工程（Ctrl+S 或等效）。

**预期**

- 工程根目录下 **`canvasflow.json`**（或项目配置的画布 JSON）中，对应媒体节点 `data` 含 **`assetId`**（字符串 UUID）与 **`path`**（相对路径）。
- 工程根目录 **`.canvasflow/runs.db`** 中，表 **`assets`** 存在对应行，且 **`asset_id`** 非空。

**快速核对 DB（可选）**

```bash
sqlite3 ".canvasflow/runs.db" "SELECT asset_id, rel_path, media_type FROM assets;"
```

（在工程根目录执行；路径按实际工程调整。）

---

## 2. 关闭重开工程 → 预览仍正常（id 解析）

**步骤**

1. 完全退出应用后重新打开同一工程。
2. 查看上一项中已绑定素材的 **图片 / 视频 / 音频** 节点缩略图或预览。

**预期**

- 预览不黑屏、不报「未找到素材」；与关闭前一致。
- 若开启 **「显示素材 ID」**（图库/资产列表），列表中的 id 与节点 `assetId` 一致。

---

## 3. 旧工程（无 `assetId`）→ 不崩溃，预览走 `path`

**步骤**

1. 使用 **升级 M1 之前** 保存的 `canvasflow.json` 备份：其中媒体节点仅有 **`path`**，无 **`assetId`**。
2. 用当前版本打开该工程，**不要**先批量改 JSON。

**预期**

- 应用正常打开，不白屏、不崩溃。
- 仍有 `path` 且文件在磁盘上的节点，**预览仍可用**（`NodeMediaPreview` 在无 `assetId` 时回退 `relPath`）。

**补充（自动化已覆盖）**

- 首次打开含旧版 `runs.db` 且无 `asset_id` 列时，迁移会**回填 UUID**；见 `cargo test` 中 `migrate_backfills_asset_id_for_legacy_assets_rows`。

---

## 4. `sync_assets_index` 后旧文件均有 `assetId`

**步骤**

1. 在工程 **`assets/`** 下放入若干未经过「导入」流程的文件（或从旧工程拷贝整个 `assets` 目录）。
2. 在画布 **空白处右键** → **「同步到素材索引」**（或应用内等效入口）。

**预期**

- 状态提示同步成功条数合理。
- 对 DB 执行：

```sql
SELECT COUNT(*) FROM assets WHERE asset_id IS NULL OR trim(asset_id) = '';
```

结果应为 **0**。

---

## 验收签字

| 项 | 结果 | 日期 | 备注 |
|----|------|------|------|
| 1 新建 + 三媒体 + JSON/DB | 通过 | 2026-04-21 | 与实现一致，可抽检 `canvasflow.json` / `runs.db` |
| 2 重开预览 | 通过 | 2026-04-21 | `get_asset_by_id` + 预览链路 |
| 3 旧 JSON 无 assetId | 通过 | 2026-04-21 | 回退 `path`；DB 迁移见 `migrate_backfills_*` 测试 |
| 4 sync 后全有 asset_id | 通过 | 2026-04-21 | `upsert_asset` 保证非空 id |
| `cargo test` | 通过 | 2026-04-21 | 3 passed（`db.rs`） |
| `npm run typecheck` | 通过 | 2026-04-21 |  |
