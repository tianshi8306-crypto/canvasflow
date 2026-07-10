# 桌面端多平台打包指南

CanvasFlow AI Studio 使用 **Tauri 2** 打包。安装包内置 **FFmpeg sidecar**，用户无需单独安装 FFmpeg。

## 产出物位置

本地打包脚本会将安装包复制到：

```
release-packages/v<版本>/<平台>/
├── CanvasFlow-AI-Studio_*_x64-setup.exe   # Windows（NSIS）
├── MANIFEST.json                          # 构建清单
```

在对应系统上完整构建后，还可能包含：

| 平台 | 典型文件 |
|------|----------|
| Windows x64 | `*_x64-setup.exe`（NSIS 安装程序） |
| macOS Apple Silicon | `*_aarch64.dmg` |
| macOS Intel | `*_x64.dmg` |
| Linux | `*_amd64.deb`、`*.AppImage` 等 |

## 一键打包（当前操作系统）

```bash
npm install
npm run package:desktop
```

等价于：

```bash
node scripts/package-desktop-release.mjs
```

脚本会：

1. 下载/准备 `src-tauri/bin/ffmpeg`（Windows 自动下载）
2. 启用 `externalBin` 并执行 `tauri build`
3. 将 `src-tauri/target/release/bundle/` 下的安装包复制到 `release-packages/`

仅收集已有构建结果（跳过编译）：

```bash
node scripts/package-desktop-release.mjs --skip-build
```

## 三平台完整打包

**Tauri 无法在一台 Windows 上直接交叉编译 macOS 安装包。** 需要：

| 平台 | 推荐方式 |
|------|----------|
| **Windows** | 在 Windows 上运行 `npm run package:desktop` |
| **Linux** | 在 Linux 或 **WSL2 Ubuntu** 上运行同一命令 |
| **macOS** | 在 macOS 上运行同一命令（Apple Silicon 与 Intel 各构建一次） |

# Linux（WSL2，在 Windows 上构建 deb 包）

```bash
wsl -e bash /mnt/d/vibevideo/scripts/wsl-package-linux.sh
```

或在 WSL 内：

```bash
cd /mnt/d/vibevideo
./scripts/wsl-package-linux.sh
```

### 使用 GitHub Actions 构建全平台（推荐分发）

1. 确保 `src-tauri/tauri.conf.json` 的 `version` 与 tag 一致
2. 创建并推送 tag：`git tag v0.5.0 && git push origin v0.5.0`
3. 或在 GitHub → Actions → **Release** → **Run workflow**，输入 tag `v0.5.0`

工作流 `.github/workflows/release.yml` 会在 Windows、macOS（双架构）、Linux 上并行构建并发布到 GitHub Releases。

## 在其他电脑安装

**Windows：** 双击 `*_x64-setup.exe`，按向导安装。无需预装 Node/Rust。

**macOS：** 打开 `.dmg`，将应用拖入「应用程序」。

**Linux：**

```bash
sudo dpkg -i CanvasFlow-AI-Studio_*_amd64.deb
# 或
chmod +x *.AppImage && ./CanvasFlow-AI-Studio_*.AppImage
```

首次使用需在应用内 **设置 → 模型** 配置 API Key；即梦图片/视频可选扫码登录。

## 环境要求（仅开发者打包时需要）

- Node.js LTS（v22 推荐）
- Rust stable（rustup）
- 各平台 Tauri 系统依赖（见 README「本地开发」）

## 故障排除

| 问题 | 处理 |
|------|------|
| `[ffmpeg] 未找到` | Windows 会自动下载；macOS/Linux 需 `brew install ffmpeg` 或 apt 安装后重试 |
| Rust 编译失败 | 安装 Visual Studio Build Tools（Windows C++ 工作负载） |
| WSL 构建很慢 | 正常；首次 Rust 编译约 10～20 分钟 |
| macOS 无法验证开发者 | 系统设置 → 安全性 → 仍要打开 |
