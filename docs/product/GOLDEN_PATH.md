# 黄金路径（手工验收）

> **用途**：单人开发时，每轮大改或发版前用本文 **10 步** 走一遍主链路，确认「能创作、能保存、能导出」未断。  
> **自动化**：E2E `npm run test:e2e:golden`（**4 条**，iter-95）；单测见 `iteration-19`（含 Tab 切换 `canvasTabSync.test.ts`）。  
> **发布清单**：合入 `npm run release:check`；发版勾选 [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md) B 档。  
> **桌面完整路径**：步骤 2、8～10 需 `npm run tauri dev`（文件对话框、保存、FFmpeg 导出）。  
> **迭代说明**：[`iteration-95-golden-path-p0-p1.md`](../iterations/iteration-95-golden-path-p0-p1.md)

---

## 前置

| 模式 | 命令 | 说明 |
|------|------|------|
| 浏览器预览 | `npm run dev` | 画布、加节点、剪辑台 UI；**不能**新建/打开工程目录、不能真导出 |
| 桌面完整 | `npm run tauri dev` | 工程 IO、资产、FFmpeg、`runs.db` |

合入推荐：`npm run release:check`（门禁 + 黄金 E2E）。发版手工：本文 B 档步骤 + [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md)。全量 E2E：`npm run release:check:full`。

---

## 步骤优先级与自动化（iter-95）

| 步骤 | 段 | 优先级 | 浏览器 | 桌面 | E2E / 单测 |
|------|-----|--------|--------|------|------------|
| 1 | 启动 | **P0** | 新建工程 → 桌面壳提示、不崩溃 | 顶栏工程菜单可用 | ✅ `golden-path` 第 1 条 |
| 2 | 工程 | **P0** | — | 新建/打开；路径；图库可点 | 手工 B 档 |
| 3 | 未保存 | **P0** | ✅ | ✅ | ✅ `golden-path` 第 2 条 |
| 4 | 脚本落画布 | **P0** | ✅ | ✅ | ✅ `golden-path` 第 3 条 |
| 5 | 脚本内容 | **P1** | — | 见下方「有 Key / 无 Key」 | 手工 B 档 |
| 6 | 视频节点 | **P1** | UI only | 见下方「有 Key / 无 Key」 | 手工 B 档 |
| 7 | 剪辑台 | **P0** | ✅ | ✅ | ✅ `golden-path` 第 4 条 |
| 8 | 从脚本填充 | **P1** | — | 连线 + 可解析路径 | 手工 B 档；`buildFromScript.test.ts` |
| 9 | 导出成片 | **P0** | — | 导出或可读错误 | 手工 B 档 |
| 10 | 持久化 | **P0** | — | 保存后重开仍在 | 手工 B 档 |

**P0**：阻断 A 档（`quality:gate` / `release:check`）或 B 档「能创作 / 能保存 / 能导出」。  
**P1**：发版 B 档应勾选；无 API Key 时可走「降级路径」仅验 UI / 入口。

### P1 · 有 Key / 无 Key 双路径（步骤 5～6、8）

| 步骤 | 已配 LLM / 视频 Key | 无 Key（降级） |
|------|---------------------|----------------|
| **5 脚本内容** | 解析或生成后分镜表 ≥1 条 `scriptBeats`，非永久失败 | 跳过生成；仅确认脚本底栏、全屏表入口可开 |
| **6 视频节点** | 多模态面板：参数分组 + **状态轨在参数区上方**（R5）；可选真生成 | 脚本→视频连线 + 打开面板，**不要求**出片 |
| **8 从脚本填充** | 剪辑台「更多」→「从脚本镜头填充」：条数与镜序一致或策略提示 | 跳过填充；仅确认菜单项存在（无路径时允许禁用或 toast） |

Tab 切换（P1）：见 `RELEASE_CHECKLIST`「Tab 切换快验」；单测 `canvasTabSync.test.ts`。

---

## 10 步手工验收

### A. 画布与工程（步骤 1～3）

1. **启动** · **P0**  
   - 桌面：`npm run tauri dev`，首屏顶栏可见工程菜单（「打开工程…」/「新建工程…」）。  
   - 浏览器：`npm run dev`，顶栏显示 **浏览器预览**；点「新建工程…」应提示需桌面壳（状态栏短文案 + `title` 完整说明），**不崩溃**。  
   - *E2E：`golden-path`「浏览器预览：点新建工程提示桌面壳且不崩溃」*

2. **工程** · **P0** · *仅桌面*  
   - 新建或打开一个空工程目录。  
   - 顶栏显示工程路径；左侧「+ 添加」里「从图库选择」由灰变可点。

3. **临时画布未保存标记** · **P0** · *浏览器即可*  
   - 无工程路径时，用空态「生文本」或左侧「+ → 文本」加一个节点。  
   - 顶栏画布标签出现 **未保存圆点**（`canvasTabUnsavedDot`），右侧轨迹区显示 **未保存** 徽章。  
   - *E2E：`golden-path`「临时画布：加节点后标签与顶栏显示未保存」*

### B. 脚本 → 视频（步骤 4～6）

4. **脚本节点落画布** · **P0** · *浏览器即可*  
   - 左侧「+ → 脚本」，画布出现脚本节点（默认标题「分镜脚本」）。  
   - 单击节点：视口聚焦脚本 Chrome；可打开全屏脚本表（双击或入口钮，以当前 UI 为准）。  
   - *E2E：`golden-path`「脚本节点可落到画布」*

5. **脚本内容** · **P1** · *桌面 + 已配 LLM 时*  
   - 连接上游文本或参考视频（可选），在脚本底栏填写主题/要求并触发解析/生成。  
   - 分镜表出现至少 1 条 `scriptBeats`；状态非永久失败。  
   - *无 Key：见上表「降级路径」*

6. **视频节点** · **P1**  
   - 从脚本 Hermes 或手动画布：脚本 → 视频节点连线。  
   - 打开视频节点多模态面板：参数分组、状态轨在底栏参数区**上方**可见（R5）。  
   - 无 API Key 时可只验 UI，不必真生成。

### C. 合成与导出（步骤 7～10）

7. **合成节点与剪辑台** · **P0** · *浏览器即可*  
   - 左侧「+ → 视频合成」，画布出现合成节点。  
   - **单击**合成节点：全屏「视频剪辑」对话框（`ComposeEditorOverlay`）。  
   - 时间线区可见；Esc 或关闭钮退出。  
   - *E2E：`golden-path`「合成节点单击打开全屏剪辑工作台」*

8. **从脚本填充** · **P1** · *桌面 + 已有镜序与视频路径*  
   - 脚本—视频—合成已连线且有可解析的片段路径。  
   - 剪辑台「更多」→「从脚本镜头填充」：时间线条目数与镜序一致（或符合当前策略提示）。

9. **导出成片** · **P0** · *桌面*  
   - 剪辑台或合成底栏执行导出；节点出现成片预览或 `path`/`assetId`。  
   - 脚本分镜区「导出成片」仍打开同一剪辑台（行为与 iteration-18 一致）。  
   - 失败时应有可读错误（toast / 状态栏），非静默无反馈。

10. **持久化** · **P0** · *桌面*  
    - `Ctrl+S` 或顶栏保存；刷新/重开工程后节点与连线仍在。  
    - 可选：打开含旧 `path` 的工程，确认 `reconcile` 未把画布打挂（iteration-17 已冻结，仅回归）。

---

## 明确不在此路径内（避免范围膨胀）

- 资产 ID 纵轴 M5（删 path、新 reconcile 策略）
- LibTV 式底部生成器 Dock、Inspector 重新挂壳
- 大规模换皮 / 新 Provider

---

## 失败时怎么做

| 现象 | 建议 |
|------|------|
| E2E 首屏 30s 超时 | 确认 1420 端口无占用；CI 外可 `reuseExistingServer` 先手动 `npm run dev` |
| 剪辑台打不开 | 查 `FlowCanvas` `onNodeClick` 对 `ffmpegConcat` 是否仍 `setComposeEditorNodeId` |
| 标签无未保存点 | 查 `projectStore.afterGraphEdit` 与 `canvasTabSync.syncActiveTabUnsaved` |
| 导出失败 | 桌面日志 + `assets/` 路径；FFmpeg 是否在 PATH / 捆绑 |
| 浏览器点新建无提示 | 查 `projectStore.newProject` 与 `DESKTOP_SHELL_HINT`、`appTopBadge--status` |

回退：按当轮 `docs/iterations/iteration-xx-*.md` 的「回退」节执行；保留失败截图与 `npm run test` / `test:e2e` 输出。

---

## 相关文档

- 进度真源：[`docs/iterations/CURRENT_PROGRESS.md`](../iterations/CURRENT_PROGRESS.md)
- iter-95 P0/P1：[`iteration-95-golden-path-p0-p1.md`](../iterations/iteration-95-golden-path-p0-p1.md)
- P3 合成闭环：[`iteration-18-p3-timeline-export.md`](../iterations/iteration-18-p3-timeline-export.md)
- 快捷键：[`SHORTCUTS.md`](SHORTCUTS.md)
