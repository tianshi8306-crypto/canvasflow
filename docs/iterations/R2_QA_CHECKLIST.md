# R2 手工验收清单（对照 iteration-02）

在冻结 R3 门闸前，建议在桌面端（`npm run tauri dev`）逐项勾选。

## 交付清单对应


| 执行单条目               | 验收要点                                                                |
| ------------------- | ------------------------------------------------------------------- |
| 五类基础节点可创作输入         | 文本 / 脚本 / 图 / 视频 / 音频节点均能编辑并在节点卡上看到摘要或预览占位                          |
| 复制 / 粘贴 / 删除 / 连线稳定 | 顶栏、快捷键、右键与仅选边删除一致；脚本 `scriptBeats` / `scriptBeatSelection` 复制后为独立副本 |
| 拖拽导入批量与反馈           | 覆盖层、成功/跳过提示；混装不支持格式时其余仍成功                                           |
| 重开工程恢复              | `canvasflow.json` 恢复节点 data、连线、视口；脚本勾选见 `scriptBeatSelection`       |


## 手工步骤（与 iteration-02 一致）

> **验收日期：2026-04-24**  
> 验收方式：由 AI 完成代码静态审计 + 自动化等价测试（`src/lib/r2ManualAcceptance.test.ts`），GUI 操作依赖 Tauri 桌面环境的条目标注跳过原因。

1. [x] 新建工程后依次创建文本、图片、视频、音频、脚本节点并填写最小内容。  
   → **自动化等价覆盖**：`§30 五类节点初始空 data`（5 用例）。`newNodeDataByType` 每类均含正确 `label` 与空 `prompt`/`path`，满足最小内容填写起点。

2. [x] 对每类节点执行选中、复制、粘贴、删除与连线，确认反馈一致。  
   → **自动化等价覆盖**：  
   - `§31 连线合法性`（6 用例）：主创作链路均允许，非法链路均拒绝；  
   - `§31 §34 复制/粘贴含脚本子图`（9 用例）：beatId 全新、副本互不冲突、下游节点 `params.scriptBeatId` 同步；  
   - `§31 deleteSelection 逻辑等价验证`（2 用例）：删节点后关联边清理、仅删边时节点不变；  
   - **静态代码审计**：`App.tsx` 全局 `keydown` 处理器确认 `Ctrl+C/V/Delete` 均路由到正确 store 方法，并在 `INPUT/TEXTAREA/contenteditable` 聚焦时正确屏蔽，满足 `R2_QA_CHECKLIST §4`。  
   - **顶栏按钮**：`AppTopBar.tsx` 复制/粘贴/删除按钮带 `disabled` 控制（`canCopy`/`canPaste`/`canDelete`）与 `title` 提示，满足 §2 可读性要求。

3. [ ] 拖入 3–5 个本地素材（混合格式），确认导入提示与节点错位排布。  
   → **跳过**（依赖 Tauri `importMediaFiles`/文件系统，无法在 vitest 中模拟）。  
   逻辑审计：`projectStore.importMediaFiles` 中 `computeBatchImportDropPositions` 确保错位排布，`skipped` 计数确保混合格式时只跳过不支持文件，状态文案符合设计要求。

4. [ ] 故意拖入不支持文件，确认失败提示可读且其余成功。  
   → **跳过**（同上，依赖 Tauri）。  
   逻辑审计：`accepted.length === 0` 时 `statusText = "导入失败：仅支持图片/视频/音频文件格式"`，其余成功条目继续处理，满足要求。

5. [ ] 保存并重启后打开工程，确认节点内容、素材路径、连线、视口及脚本条目与勾选恢复。  
   → **跳过**（依赖 Tauri `read_canvasflow_json`/`write_canvasflow_json`）。  
   逻辑审计：`serializeCanvas` → `parseCanvas` 全量序列化含 `scriptBeats`/`scriptBeatSelection`/`storyboardShots` 字段，连线经 `sanitizeCanvasEdges` 清洗后恢复，视口字段持久化，满足恢复要求。

---

### 自动化测试汇总（2026-04-24）

| 测试文件 | 用例数 | 结果 |
|---|---|---|
| `r2ManualAcceptance.test.ts`（新增） | 20 | ✅ 全通过 |
| `pasteScriptBeatRemap.test.ts` | 5 | ✅ 全通过 |
| `flowConnectionPolicy.disabledEdge.test.ts` | 1 | ✅ 全通过 |
| 其余 6 个现有文件 | 23 | ✅ 全通过 |
| **合计** | **49** | **✅ 全通过** |

TypeCheck：`tsc -b` 零错误。

## 已知环境说明

- **媒体预览**：依赖 Tauri 与 `convertFileSrc`；纯浏览器 dev 可能仅能看路径文案。  
- **Rust**：未安装 `cargo` 时无法本地跑 `tauri dev`，验收可改用已构建的安装包。

## 视觉与可用性（补充勾选项）

对照 [UI 迭代指南](../design/UI_ITERATION_GUIDE.md) 第 4 节。

1. [ ] 空状态（无节点、无素材、无脚本条目等）有简短说明，用户知道下一步操作。
2. [ ] 错误与禁用态可读；禁用按钮在合理处有 `title` 或等价说明（若适用）。
3. [ ] 顶栏状态、画布覆盖层与侧栏信息层级不互相遮挡关键操作。
4. [ ] 在侧栏 `INPUT`/`TEXTAREA` 聚焦时，退格/删除不会误删画布节点（与全局快捷键策略一致）。
5. [ ] 节点卡与侧栏字段命名、顺序在「文本 / 脚本 / 媒体」间无明显割裂感。