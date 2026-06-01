# CanvasFlow AI Studio（本地版）

轻量桌面客户端：无限画布 + 节点工作流 + 多厂商 OpenAI 兼容 API + 本地工程与运行日志。

## 环境要求

- Node.js（LTS）
- Rust（rustup 安装 `stable`）
- Windows 建议安装 **Visual Studio Build Tools**（若 `cargo` 编译 Tauri 报错时再装）

## 安装依赖

```bash
cd d:\vibevideo
npm install
```

## 开发运行

**完整功能（新建/打开工程、保存、导入素材、LLM、分镜生成等）必须用 Tauri 壳运行**，不要只用下面的纯 Vite 浏览器预览。

```bash
npm run tauri dev
```

首次会编译 Rust 端，耗时可能几分钟。

**纯浏览器（仅布局预览）**：`npm run dev` 后打开 `http://127.0.0.1:1420`（或 `http://localhost:1420`）。此时 Tauri 命令不可用，工程与 API 相关操作会失败；**分镜文案等界面**需先在画布添加并**选中「分镜脚本」节点**，在右侧「节点属性」里**向下滚动**才能看到「脚本工作台」和「分镜文案（R4）」区块。

## 生产构建

```bash
npm run tauri build
```

安装包输出在 `src-tauri/target/release/bundle/`。

## 质量门禁（建议提交前执行）

**快速门禁**（不含 E2E，适合日常提交）：

```bash
npm run quality:gate
```

该命令会依次执行：

- TypeScript 类型检查
- ESLint 静态检查
- Vitest 单测 + 覆盖率阈值
- Rust 单测

**完整门禁**（与 CI 对齐：含 Playwright E2E；首次需先安装 Chromium）：

```bash
npm run test:e2e:install
npm run quality:gate:full
```

`quality:gate:full` = `quality:gate` + `npm run test:e2e`（会自动拉起 `npm run dev` 作为 webServer）。

日常 PR 推荐（门禁 + 黄金路径 3 条 E2E）：

```bash
npm run release:check
```

发版前完整清单见 [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md)。

### 端到端（E2E，Playwright）

首次在本机跑 E2E 前需安装浏览器内核：

```bash
npm run test:e2e:install
npm run test:e2e
# 仅黄金路径 3 条冒烟（更快）
npm run test:e2e:golden
```

主链路手工步骤见 [`docs/product/GOLDEN_PATH.md`](docs/product/GOLDEN_PATH.md)。

CI 中会单独跑 E2E，并上传 `playwright-report` 与 `test-results` 产物；`e2e/visual-archive.spec.ts` 会附带首屏截图便于人工验收（非像素对比基线）。

### 工程化补充（P0 / P1 / P2）

| 层级 | 内容 |
|------|------|
| P0 | CI（typecheck / lint / 覆盖率）、`coverage/` 产物归档、`.cursorignore` |
| P1 | Playwright 冒烟 + 截图归档、根级 `ErrorBoundary`、统一 `appLogger` |
| P2 | Dependabot（npm + cargo）、PR 模板自检清单 |

## 工程目录结构（打开工程时）

- `canvasflow.json`：画布节点、连线与视口
- `assets/`：素材目录（自行放入或引用相对路径）
- `.canvasflow/runs.db`：运行记录与事件日志（SQLite）

## 使用说明（最小）

1. 点击「新建工程」或「打开工程」，选择一个空文件夹作为工程根目录。
2. 在「设置」里填写 Provider 的 Base URL / Model，并保存 API Key（写入系统凭据，不会写进工程文件）。
3. 右侧添加 **LLM** 节点，填写提示词，点击「运行工作流」。
4. **FFmpeg 合成**节点需要本机已安装 `ffmpeg` 并在 PATH 中，或在设置里填写 `ffmpeg` 可执行文件路径。

## 产品与 LibTV 式体验对齐（防偏离）

- LibTV 操作指南能力树 ↔ 本仓库 R 轮对照：[docs/product/LIBTV_GUIDE_ALIGNMENT.md](docs/product/LIBTV_GUIDE_ALIGNMENT.md)（原图可参考你本机 `D:\libtv\*.png`）

## 低复杂度迭代文档

- 路线图 V2（9 轮边界）：`docs/iterations/ROADMAP_V2.md`
- UI / 体验迭代指南（执行单 UI 小节与按轮强度）：`docs/design/UI_ITERATION_GUIDE.md`
- 迭代模板：`docs/iterations/ITERATION_TEMPLATE.md`
- 第 1 轮执行单（范围、验收、回退）：`docs/iterations/iteration-01-project-skeleton.md`
- 第 2 轮执行单（画布与五节点体验重构）：`docs/iterations/iteration-02-canvas-and-nodes.md`
- R2 合并验收勾选项：`docs/iterations/R2_QA_CHECKLIST.md`
- 第 3 轮执行单（脚本工作台 v1）：`docs/iterations/iteration-03-script-workbench.md`
- 第 4 轮执行单（分镜文案 v1）：`docs/iterations/iteration-04-storyboard-v1.md`
- 第 5 轮执行单（分镜关联本地图）：`docs/iterations/iteration-05-storyboard-local-image.md`
- 第 6 轮执行单（脚本全屏表格）：`docs/iterations/iteration-06-script-fullscreen-table.md`
