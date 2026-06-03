# 发布前检查清单

> **真源**：日常合入看 **A 档**；发版或大改画布/工程/导出前跑 **B 档** + 手工黄金路径。  
> 主链路手工 10 步：[`docs/product/GOLDEN_PATH.md`](docs/product/GOLDEN_PATH.md)（含 P0/P1 对照表，iter-95）  
> 监控迭代：[`iteration-19`](docs/iterations/iteration-19-maturity-monitoring.md) · [`iteration-95`](docs/iterations/iteration-95-golden-path-p0-p1.md)

---

## 一键命令（推荐）

| 场景 | 命令 | 包含内容 |
|------|------|----------|
| **日常 PR** | `npm run release:check` | `quality:gate` + 黄金路径 E2E **4 条** |
| **与 CI 完全一致** | `npm run release:check:full` | `quality:gate:full`（全量 E2E） |
| **仅门禁（最快）** | `npm run quality:gate` | typecheck + lint + 覆盖率 Vitest + Rust |

首次跑 E2E 前：`npm run test:e2e:install`。

---

## A 档 — 每次合入 / PR（自动化勾选）

运行 `npm run release:check` 通过后，在 PR 中勾选：

- [ ] **TypeScript** — `npm run typecheck` 无错误  
- [ ] **Lint** — `npm run lint` 无错误  
- [ ] **前端单测 + 覆盖率** — `npm run test:coverage` 达阈值  
- [ ] **Rust 单测** — `npm run test:rust` 通过  
- [ ] **黄金路径 E2E** — `npm run test:e2e:golden` **4 条**通过（浏览器，自动起 `npm run dev`）  
- [ ] **关键路径单测**（改 Tab/合成/脚本导出时必看）— `projectStore.goldenPath.test.ts`、`canvasTabSync.test.ts`、`compose/buildFromScript.test.ts` 仍绿  

`quality:gate` 分解（与 `release:check` 前半相同）：

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run test:rust
```

---

## B 档 — 发版 / 大改前（手工 + 桌面）

在 A 档基础上，**桌面**执行 `npm run tauri dev`，按 [`GOLDEN_PATH.md`](docs/product/GOLDEN_PATH.md) 勾选。下表标注 **P0**（必做）/ **P1**（发版建议；无 Key 可走降级）。

### 工程与画布

- [ ] **P0 · 步骤 1～2**：新建或打开工程；顶栏路径正确；图库可点（步骤 1 浏览器部分已由 E2E 覆盖）  
- [ ] **P0 · 步骤 3**：临时画布加节点 → 标签未保存点 + 顶栏「未保存」  
- [ ] **P1 · Tab 切换**：两个画布标签各放不同节点，切换后节点集不串（见下方「Tab 切换快验」）

### 生产链路

- [ ] **P0 · 步骤 4、7**：脚本落画布；合成节点打开剪辑台（浏览器 E2E 可对照）  
- [ ] **P1 · 步骤 5～6**（已配 LLM/视频 Key）：至少 1 镜；视频面板与状态轨在参数区**上方**  
- [ ] **P1 · 步骤 5～6 降级**（无 Key）：脚本底栏/全屏表可开；视频面板 UI 可开，不要求出片  
- [ ] **P1 · 步骤 8**（有路径时）：「从脚本镜头填充」镜序与条数一致或策略提示  
- [ ] **P0 · 步骤 9～10**：导出成片或可读错误；保存后重开工程，节点与连线仍在  

### 安全与产物

- [ ] **API Key** 未写入 `canvasflow.json` 或导出 zip（抽查工程目录）  
- [ ] **干净机器 / 新用户**：安装 release 包后设置页 Key 为空；开发 Key 仅在 `%APPDATA%\canvasflow-dev\`（dev）与 `%APPDATA%\canvasflow\`（release）隔离  
- [ ] **明文 vault**：release 启动后 `%APPDATA%\canvasflow\api-keys.json` 应不存在（Key 仅在系统凭据管理器；仅 keyring 不可用时才保留兜底文件）  
- [ ] **时间线导出**（若本轮动 FFmpeg）：`assets/exports/` 下有成片或预期错误提示可读  
- [ ] **工作流**（若本轮动执行器）：至少一个 LLM/脚本节点运行有状态反馈（非静默失败）

### Tab 切换快验（30 秒）· P1

1. 标签 A：加一个「文本」节点，确认未保存标记。  
2. 点「+」新建标签 B，加一个「脚本」节点。  
3. 点回标签 A → 应只剩文本节点；再点 B → 应只剩脚本节点。  

### 迭代与回退

- [ ] 当前轮 `docs/iterations/iteration-xx-*.md` 验收步骤已执行  
- [ ] 失败触发条件与回退动作已记录（日志 / 截图 / 样本输入）

可选全量 E2E：`npm run release:check:full`（含 `e2e/smoke.spec.ts` 等全部用例）。

---

## C 档 — 文档与路线图对齐

- [ ] 迭代文档符合 [`docs/iterations/ITERATION_TEMPLATE.md`](docs/iterations/ITERATION_TEMPLATE.md)  
- [ ] 与 [`docs/iterations/ROADMAP_V2.md`](docs/iterations/ROADMAP_V2.md) 阶段一致（未越序做 R7+ 大项）  
- [ ] 四层架构映射已写明（创作 / 生产 / 编排 / 资产）  
- [ ] 主链路连通：主题 → 脚本 → 分镜 → 视频 → 时间线 → 导出  
- [ ] 功能/入口变更已更新 `README.md` 或对应 iteration 文档  

---

## 不在本清单内（刻意不做）

- 资产 ID 纵轴 M5、Inspector 挂回 App 壳、LibTV 底部 Dock  
- Tauri 桌面 E2E 自动化、像素级视觉回归  

---

## Windows 打包补充（发安装包时）

- [ ] `npm run desktop:build:with-ffmpeg`（或项目既定打包脚本）成功  
- [ ] 新包在本机可启动、可打开既有工程  
- [ ] 版本号 / 更新说明已记录；若走 Actions 发版，确认 `TAURI_SIGNING_PRIVATE_KEY` 已配置（见 [`docs/product/APP_UPDATES.md`](docs/product/APP_UPDATES.md)）  
