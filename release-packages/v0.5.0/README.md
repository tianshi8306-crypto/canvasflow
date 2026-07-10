# CanvasFlow AI Studio v0.5.0 安装包

本目录包含可在其他电脑上**独立安装**的桌面客户端（已内置 FFmpeg，无需单独安装 Node/Rust）。

## 文件说明

| 目录 | 平台 | 安装文件 | 安装方式 |
|------|------|----------|----------|
| `windows-x64/` | Windows 10/11 64 位 | `CanvasFlow AI Studio_0.5.0_x64-setup.exe` | 双击安装程序，按向导完成 |
| `linux-x64/` | Ubuntu / Debian 64 位 | `CanvasFlow AI Studio_0.5.0_amd64.deb` | `sudo dpkg -i *.deb` |
| `macos-aarch64/` | macOS Apple Silicon | （需在本机或 CI 构建） | 见下方说明 |
| `macos-x64/` | macOS Intel | （需在本机或 CI 构建） | 见下方说明 |

每个子目录内的 `MANIFEST.json` 记录构建时间与文件大小。

## 首次使用

1. 安装并启动 **CanvasFlow AI Studio**
2. 顶栏 → **新建工程**，选择本地文件夹
3. 左侧 **设置** → **模型**，配置 API Key（即梦可选扫码登录）
4. 开始创作

## macOS 安装包如何获取

macOS 必须在 **Mac 电脑**上构建，或推送 Git tag 触发 GitHub Actions：

```bash
# 在 macOS 上
npm install
npm run package:desktop
```

或 GitHub → Actions → **Release** → Run workflow，tag 填 `v0.5.0`。

## 重新打包

```bash
# 当前系统（Windows / Linux / macOS）
npm install
npm run package:desktop

# Windows 上构建 Linux（WSL2）
wsl -e bash /mnt/d/vibevideo/scripts/wsl-package-linux.sh
```

详见 [docs/release/DESKTOP_PACKAGING.md](../docs/release/DESKTOP_PACKAGING.md)。

## 版本

- 产品名：CanvasFlow AI Studio
- 版本：0.5.0
- 许可证：Apache-2.0
