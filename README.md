# CanvasFlow AI Studio

<div align="center">

**无限画布 · 节点工作流 · AI 视频创作一站式桌面工具**

[![Release](https://img.shields.io/github/v/release/tianshi8306-crypto/vibevideo?style=flat-square)](https://github.com/tianshi8306-crypto/vibevideo/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](#安装)

</div>

---

## 简介

CanvasFlow AI Studio 是一款本地桌面创作工具，将**无限画布 + 节点工作流 + 多模态 AI**整合进一个轻量应用。你可以在画布上自由组织创作思路，通过连线驱动 AI 生成脚本、分镜、视频，最终一键导出成片。

> 基于 **Tauri 2 + React + Rust** 构建，跨平台支持 Windows / macOS / Linux。AI 能力通过标准 OpenAI 兼容接口接入，适配 DeepSeek、OpenAI、本地模型等各类提供商。

---

## 核心能力

### 🎨 无限画布工作流
- 基于 **React Flow** 的无限缩放画布，支持自由拖放、连线、分组
- 双击画布即可快速新建节点，无需菜单操作
- 完整撤销/重做历史，自动保存到本地工程文件

### 🤖 AI 生产流水线
从创意到成片的完整链路：

```
主题输入 → 脚本生成 → 分镜生成 → 视频生成 → 时间线导出
```

| 节点类型 | 能力 |
|---------|------|
| **LLM** | 接入任意 OpenAI 兼容 API，流式输出 |
| **脚本节点** | AI 生成结构化脚本（ScriptBeat），支持全屏编辑表格 |
| **视频节点** | 多模态参数面板，对接即梦 Seedance 2.0 等视频生成 API |
| **图片资产** | 本地图片导入，支持 `@image#1:xxx.png` 脚本引用格式 |
| **媒体导入** | 导入本地视频/音频，作为工作流的素材输入 |
| **FFmpeg 合成** | 本地 FFmpeg 驱动，将多段视频自动拼接导出 |
| **音频 TTS** | 文字转语音节点 |
| **文本节点** | 自由文本，可连接到任意节点作为输入 |

### 💾 本地工程管理
- 工程以目录形式保存（`canvasflow.json` + `assets/` + `.canvasflow/runs.db`）
- SQLite 记录每次运行日志，可回溯执行历史
- API Key 写入系统凭据管理器，**不写入工程文件**

### 🔄 自动更新
- 内置 Tauri Updater，新版本发布后可一键更新
- 更新包经 minisign 签名验证，保证完整性

---

## 安装

在 [Releases 页面](https://github.com/tianshi8306-crypto/vibevideo/releases/latest) 下载对应平台安装包：

| 平台 | 文件 |
|------|------|
| Windows | `*_x64-setup.exe` 或 `*_x64_en-US.msi` |
| macOS (Apple Silicon) | `*_aarch64.dmg` |
| macOS (Intel) | `*_x64.dmg` |
| Linux (Debian/Ubuntu) | `*_amd64.deb` |
| Linux (通用) | `*_amd64.AppImage` |

---

## 快速上手

1. **新建工程** — 顶栏点击「新建工程」，选择一个空文件夹作为工程根目录
2. **配置 AI 接入** — 打开「设置」，填写 Provider 的 Base URL / Model 名称，保存 API Key
3. **创建节点** — 双击画布空白处，选择节点类型（LLM / 脚本 / 视频等）
4. **连线驱动** — 拖动节点输出端口连接下游节点，形成工作流
5. **运行** — 顶栏点击「运行工作流」，查看 AI 流式生成结果
6. **导出** — 配置 FFmpeg 合成节点后，一键导出成片到本地

---

## 本地开发

### 环境要求

- **Node.js** LTS（推荐 v22）
- **Rust** stable（通过 [rustup](https://rustup.rs/) 安装）
- **Windows** 额外需要：Visual Studio Build Tools（含 C++ 工作负载）
- **Linux** 额外需要：WebKit2GTK 及 GTK 开发库（见下方）

```bash
# Linux 依赖（Ubuntu/Debian）
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf \
  libgtk-3-dev libglib2.0-dev libcairo2-dev libpango1.0-dev \
  libgdk-pixbuf2.0-dev libatk1.0-dev libsoup-3.0-dev
```

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
# 完整桌面模式（推荐）—— 工程 IO、API、FFmpeg 等全部可用
npm run tauri dev

# 纯浏览器预览（仅 UI 布局）—— Tauri 命令不可用
npm run dev
```

首次编译 Rust 端需要几分钟，后续增量编译很快。

### 生产构建

```bash
# 普通构建
npm run tauri build

# 含 FFmpeg 嵌入的完整构建（CI 使用）
npm run desktop:build:with-ffmpeg
```

安装包输出在 `src-tauri/target/release/bundle/`。

---

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                   React 前端                     │
│  React Flow 画布 │ Zustand 状态 │ xState 流转    │
│  节点组件 (llm/script/video/media/ffmpeg/…)      │
└────────────────────┬────────────────────────────┘
                     │ Tauri IPC (invoke)
┌────────────────────▼────────────────────────────┐
│                  Rust 后端                       │
│  graph_flow 执行引擎 │ llm.rs 流式调用           │
│  script_node │ ffmpeg │ hermes_agent             │
│  rusqlite (runs.db) │ keyring (API Key)          │
└─────────────────────────────────────────────────┘
```

### 关键技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 18 + TypeScript + Vite |
| 画布 | @xyflow/react (React Flow) |
| 状态管理 | Zustand 5 |
| 后端 | Rust + Tokio |
| 数据库 | SQLite (rusqlite, bundled) |
| HTTP | reqwest (rustls, 支持流式) |
| 测试 | Vitest + Playwright + Rust cargo test |

### 项目结构

```
vibevideo/
├── src/                    # React 前端
│   ├── App.tsx             # 根组件，键盘快捷键，Hermes 初始化
│   ├── components/         # 节点组件、顶栏、画布等
│   │   ├── nodes/          # 各类节点 UI 组件
│   │   └── canvas/         # 画布、工具栏等
│   ├── store/              # Zustand 状态（project/canvas/history）
│   ├── lib/                # 类型定义、节点运行时、连线策略
│   │   └── nodeAgentRuntime/  # LLM/脚本/视频/音频 Agent
│   └── shared/api/         # 前端 API 调用封装
├── src-tauri/              # Rust 后端
│   ├── src/commands/       # Tauri 命令处理（20+ 命令组）
│   └── src/executor/       # 执行引擎（图流、LLM、FFmpeg、脚本）
├── scripts/                # 构建脚本（含 FFmpeg 打包）
├── docs/                   # 产品文档、迭代记录、设计规范
└── e2e/                    # Playwright 端到端测试
```

---

## 质量保障

```bash
# 快速门禁（日常提交前）
npm run quality:gate
# = TypeScript 类型检查 + ESLint + Vitest 单测覆盖率 + Rust 单测

# 完整门禁（发版前，含 E2E）
npm run test:e2e:install  # 首次需要安装 Chromium
npm run quality:gate:full

# 推荐 PR 流程（门禁 + 黄金路径 E2E）
npm run release:check
```

CI 在每次 push 时自动运行质量门禁，Release tag 触发全平台打包并发布到 GitHub Releases。

---

## 贡献

欢迎提 Issue 和 PR！开始之前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

迭代遵循**低复杂度迭代规范**：每轮 1 个核心目标、3 个模块、2-4 个功能项。详见 [docs/iterations/](docs/iterations/) 目录。

---

## 许可证

[Apache License 2.0](LICENSE) © 2026 CanvasFlow
