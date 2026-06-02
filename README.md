# CanvasFlow AI Studio

<div align="center">

**无限画布 × AI 创作灵体 × 节点工作流 —— 从灵感到成片，一气呵成**

[![Release](https://img.shields.io/github/v/release/tianshi8306-crypto/canvasflow?style=flat-square)](https://github.com/tianshi8306-crypto/canvasflow/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](#安装)

</div>

---

## 它是什么

CanvasFlow AI Studio 是一款跨平台桌面创作工具，将**无限画布 + AI 创作灵体 + 节点工作流**融合为一个轻量应用。

- **创作者**：在画布上自由组织灵感，连线驱动 AI 生成脚本、分镜、图片、视频，一键导出成片
- **开发者**：基于 Tauri 2 + React + Rust 全栈架构，React Flow 画布 + xState 状态机 + Zustand 状态管理，20+ Tauri 命令组，完善的 E2E 与单元测试

> AI 能力通过 **OpenAI 兼容接口**接入（DeepSeek、OpenAI、本地模型等均可），图片/视频生成额外支持**即梦 Seedance 2.0 本地 CLI**直连。

---

## 核心能力

### 🎨 无限画布

- 基于 **React Flow** 的无限缩放画布，自由拖放、连线、分组
- 双击空白处快速新建节点，左侧「+」面板按类型添加
- 完整撤销/重做历史，自动保存到本地工程目录
- 9 种节点类型覆盖从文本到成片的全链路

### 🤖 AI 创作灵体

画布内置一个自研的**创作灵体**——它不是独立聊天窗口，而是理解画布上下文的创作搭档：

- **感知画布**：自动读取上游节点的资产卡（文本、脚本、图片、视频），理解当前创作进度
- **分身专家**：根据节点类型切换角色——故事建筑师（文本）、脚本医生（分镜）、视觉导演（图片）、电影摄影师（视频）、声音设计师（音频）
- **意图执行**：识别制片意图后，自动规划并执行节点操作（生成脚本、提交出图/出视频等），支持自动执行和确认执行两种模式
- **MCP 扩展**：可接入外部 MCP Server（stdio 子进程），扩展灵体的工具能力
- **知识库**：支持工程级和全局知识库注入，为灵体提供项目专属的创作规则和素材

### 🔗 节点工作流

9 种节点，连线即驱动：

| 节点 | 类型键 | 能力 |
|------|--------|------|
| **文本** | `textNode` | 自由文本输入，可连接到任意节点作为 prompt 素材 |
| **LLM** | `llm` | OpenAI 兼容 API 流式生成，可切换 Provider / Model |
| **脚本** | `scriptNode` | AI 生成结构化分镜脚本（ScriptBeat），全屏编辑表格 |
| **视频** | `videoNode` | 多模态生成面板（文生视频 / 图生视频 / 参考图+视频等），通过即梦 CLI 本地调用 |
| **图片** | `imageNode` | 文生图 / 图生图 / 多参考图融合，支持 `@image#1:xxx.png` 引用格式 |
| **音频** | `audioNode` | TTS 文字转语音，支持音色/语速/情感调节 |
| **媒体导入** | `mediaImport` | 导入本地视频/音频文件，作为工作流素材源 |
| **FFmpeg 合成** | `ffmpegConcat` | 本地 FFmpeg 拼接多段视频，全屏剪辑台 + 时间线 |
| **分组** | `group` | 画布分组容器，视觉整理复杂工作流 |

### 🎬 从灵感到成片

完整创作链路：

```
主题输入 → 脚本生成 → 分镜镜头 → 视频生成 → 剪辑合成 → 导出成片
```

- 脚本节点支持从上游文本 / LLM 输出自动生成结构化分镜表
- 视频节点支持文生视频、图生视频、首尾帧、视频续写等多种工作流
- 合成节点提供全屏剪辑台，支持时间线拖拽、从脚本镜头自动填充
- FFmpeg 本地导出，无需上传云端

### ⚙️ 设置系统

- **模型设置**：5 个子 Tab（总览 / 文本 / 图 / 视 / 音），分别配置 Provider 和 Model
- **即梦登录**：总览 Tab 内置即梦 AI 扫码授权，自动管理 CLI 登录态
- **API Key 安全**：密钥写入系统凭据管理器（keyring），**不写入工程文件或配置文件**

### 💾 本地工程管理

工程以**目录**形式保存，不是单文件：

```
my-project/
├── canvasflow.json     # 画布图结构 + 节点数据
├── assets/             # 所有生成/导入的媒体资产
└── .canvasflow/
    └── runs.db         # SQLite 运行日志（可回溯）
```

### 🔄 自动更新

- 内置 Tauri Updater，新版本发布后应用内提示一键更新
- 更新包经 minisign 签名验证，保证完整性

---

## 安装

在 [Releases 页面](https://github.com/tianshi8306-crypto/canvasflow/releases/latest) 下载对应平台安装包：

| 平台 | 文件 |
|------|------|
| Windows | `CanvasFlow-AI-Studio_*_x64-setup.exe` 或 `.msi` |
| macOS (Apple Silicon) | `*_aarch64.dmg` |
| macOS (Intel) | `*_x64.dmg` |
| Linux (Debian/Ubuntu) | `*_amd64.deb` |
| Linux (Fedora/RHEL) | `*.rpm` |
| Linux (通用) | `*_amd64.AppImage` |

---

## 快速上手

1. **新建工程** — 顶栏「新建工程」，选择一个空文件夹作为工程根目录
2. **配置 AI 接入** — 打开「设置 → 模型」，填写 Provider 的 Base URL / Model 名称，保存 API Key（存入系统凭据管理器）
3. **配置即梦（可选）** — 设置 → 模型 → 总览 → 即梦登录，扫码授权后可使用图片/视频生成
4. **创建节点** — 双击画布空白处，或从左侧「+」面板选择节点类型
5. **连线驱动** — 拖动节点端口连接下游节点，形成工作流
6. **执行** — 点击单个节点执行，或通过灵体对话自动驱动整条链路
7. **导出成片** — 合成节点内拼接视频，一键导出到本地

---

## 本地开发

### 环境要求

- **Node.js** LTS（推荐 v22）
- **Rust** stable（通过 [rustup](https://rustup.rs/) 安装）
- **Windows**：Visual Studio Build Tools（含 C++ 工作负载）
- **Linux**：WebKit2GTK 及 GTK 开发库（见下方）

```bash
# Linux 依赖（Ubuntu/Debian）
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf \
  libgtk-3-dev libglib2.0-dev libcairo2-dev libpango1.0-dev \
  libgdk-pixbuf2.0-dev libatk1.0-dev libsoup-3.0-dev
```

### 安装与运行

```bash
npm install

# 完整桌面模式（推荐）
# 工程 IO、即梦 CLI、FFmpeg、凭据管理器等全部可用
npm run tauri dev

# 纯浏览器预览（仅 UI）
# Tauri 命令不可用，适合纯前端开发
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
┌──────────────────────────────────────────────────────────┐
│                      React 前端                           │
│                                                          │
│  React Flow 无限画布 │ 节点组件 (9 种) │ 左侧添加面板    │
│  Zustand 全局状态    │ xState 状态流转 │ 创作灵体 UI      │
│  --cf-* 色彩 Token   │ Tauri IPC 前端封装               │
└────────────────────────┬─────────────────────────────────┘
                         │ Tauri IPC (invoke / events)
┌────────────────────────▼─────────────────────────────────┐
│                      Rust 后端                            │
│                                                          │
│  执行引擎：graph_flow (DAG 拓扑) │ llm (流式 OpenAI)     │
│  节点执行：script_node │ ffmpeg │ asset_resolve           │
│  创作灵体：hermes_agent (分身+意图识别+自动执行)          │
│  即梦 CLI：dreamina_cli │ dreamina_gen (扫码登录+生成)    │
│  存储：rusqlite (runs.db) │ keyring (API Key) │ fs       │
│  扩展：hermes_mcp (stdio 子进程) │ hermes_knowledge       │
└──────────────────────────────────────────────────────────┘
```

### 关键技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 18 + TypeScript + Vite |
| 画布 | @xyflow/react (React Flow) |
| 全局状态 | Zustand 5 |
| 状态流转 | xState |
| 样式系统 | CSS + `--cf-*` 色彩 Token |
| 后端 | Rust + Tokio |
| 数据库 | SQLite (rusqlite, bundled) |
| AI 接入 | OpenAI 兼容 API + 即梦 CLI 本地调用 |
| 视频合成 | FFmpeg (embedded binary) |
| 安全存储 | keyring (系统凭据管理器) |
| 测试 | Vitest + Playwright + cargo test |

### 项目结构

```
canvasflow/
├── src/                        # React 前端
│   ├── App.tsx                 # 根组件，键盘快捷键，灵体初始化
│   ├── components/
│   │   ├── nodes/              # 9 种节点 UI 组件
│   │   │   ├── LLMNode.tsx
│   │   │   ├── TextNode.tsx
│   │   │   ├── MinimalScriptNode.tsx
│   │   │   ├── MinimalVideoNode.tsx
│   │   │   ├── MinimalImageNode.tsx
│   │   │   ├── MinimalAudioNode.tsx
│   │   │   ├── FFmpegNode.tsx
│   │   │   ├── MediaImportNode.tsx
│   │   │   └── GroupNode.tsx
│   │   ├── canvas/             # 画布、工具栏、节点类型注册
│   │   └── ...                 # 顶栏、设置面板、灵体面板等
│   ├── store/                  # Zustand 状态（24 个 store）
│   │   ├── projectStore.ts     # 工程/画布核心状态
│   │   ├── canvasUiStore.ts    # 画布 UI 状态
│   │   ├── hermesTaskStore.ts  # 灵体任务队列
│   │   └── ...
│   ├── lib/
│   │   ├── nodeAgentRuntime/   # 节点级 Agent 运行时
│   │   ├── videoNodeTypes.ts   # 视频节点领域模型
│   │   └── types.ts            # FlowNodeData 等核心类型
│   ├── shared/api/             # 前端 API 调用封装
│   └── styles/
│       └── global.css          # 全局样式 + --cf-* 色彩 Token
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── commands/           # Tauri 命令处理（20+ 命令组）
│   │   ├── executor/           # 执行引擎
│   │   │   ├── engine.rs       # DAG 拓扑执行
│   │   │   ├── graph_flow.rs   # 图流控制
│   │   │   ├── llm.rs          # OpenAI 流式调用
│   │   │   ├── hermes_agent.rs # 创作灵体核心
│   │   │   ├── hermes_asset.rs # 资产卡构建
│   │   │   ├── script_node.rs  # 脚本节点执行
│   │   │   ├── script_parse.rs # 脚本解析
│   │   │   ├── ffmpeg.rs       # FFmpeg 拼接
│   │   │   └── asset_resolve.rs # 资产路径解析
│   │   ├── dreamina_cli.rs     # 即梦 CLI 登录与状态管理
│   │   ├── dreamina_gen.rs     # 即梦图片/视频生成
│   │   ├── settings.rs         # 应用设置（Provider/Model/Agent 配置）
│   │   ├── graph.rs            # CanvasGraph 序列化
│   │   ├── db/                 # SQLite 运行日志
│   │   ├── vault.rs            # keyring 凭据管理
│   │   ├── hermes_knowledge/   # 知识库模块
│   │   ├── mcp_stdio.rs        # MCP Server 子进程管理
│   │   └── compose_concat.rs   # 视频合成
│   └── tauri.conf.json         # Tauri 配置
├── scripts/
│   └── tauri-build-with-ffmpeg.mjs  # 生产构建（含 FFmpeg 嵌入）
├── docs/                       # 产品文档、迭代记录、设计规范
│   ├── product/                # 产品状态矩阵、黄金路径、路线图
│   ├── iterations/             # 迭代记录（iteration-1 ~ iteration-95+）
│   └── design/                 # 架构规范、色彩系统、UI 设计
├── e2e/                        # Playwright 端到端测试
└── .github/workflows/          # CI/CD（质量门禁 + 全平台 Release）
```

---

## 质量保障

```bash
# 快速门禁（日常提交前）
npm run quality:gate
# = TypeScript 类型检查 + ESLint + Vitest 单测 + Rust 单测

# 完整门禁（发版前，含 E2E）
npm run test:e2e:install   # 首次需要安装 Chromium
npm run quality:gate:full

# 发版检查（门禁 + 黄金路径 E2E，推荐 PR 流程）
npm run release:check
```

CI 在每次 push 时自动运行质量门禁，Release tag 触发全平台打包并发布到 GitHub Releases。

---

## 贡献

欢迎提 Issue 和 PR！开始之前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

核心约定：

- **四层架构**：创作体验层 → 生产链路层 → 能力编排层 → 资产与质量层
- **低复杂度迭代**：每轮 1 个核心目标、3 个模块、2-4 个功能项
- **黄金路径验收**：10 步手工验收 + E2E 自动化覆盖 P0 链路
- 详见 [docs/iterations/](docs/iterations/) 目录

---

## 许可证

[Apache License 2.0](LICENSE) © 2026 CanvasFlow AI Studio
