#!/usr/bin/env bash
# 在 WSL2 Ubuntu 内构建 Linux 安装包（使用 Linux 本地 node_modules，避免与 Windows 冲突）
set -euo pipefail

WIN_ROOT="/mnt/d/vibevideo"
BUILD_DIR="${CANVASFLOW_LINUX_BUILD_DIR:-/tmp/canvasflow-linux-build}"

echo "==> CanvasFlow Linux 打包 (WSL)"
echo "    源目录: $WIN_ROOT"
echo "    构建目录: $BUILD_DIR"

export DEBIAN_FRONTEND=noninteractive
if ! dpkg -s libwebkit2gtk-4.1-dev >/dev/null 2>&1; then
  echo "==> 安装 Linux 构建依赖…"
  apt-get update -qq
  apt-get install -y -qq \
    build-essential \
    curl \
    rsync \
    pkg-config \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    libgtk-3-dev \
    libglib2.0-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libgdk-pixbuf2.0-dev \
    libatk1.0-dev \
    libsoup-3.0-dev \
    ffmpeg
fi

if ! command -v rustc >/dev/null 2>&1; then
  echo "==> 安装 Rust…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
fi
# shellcheck source=/dev/null
source "${HOME}/.cargo/env" 2>/dev/null || true

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: 需要 Node.js 22+"
  exit 1
fi

echo "==> 同步源码到 Linux 文件系统（排除 node_modules / target）…"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
rsync -a \
  --exclude node_modules \
  --exclude 'src-tauri/target' \
  --exclude 'src-tauri/bin/ffmpeg' \
  --exclude 'src-tauri/bin/ffmpeg-*' \
  --exclude release-packages \
  --exclude dist \
  "$WIN_ROOT/" "$BUILD_DIR/"

cd "$BUILD_DIR"

echo "==> npm ci + Linux 原生可选依赖…"
npm ci --no-audit --no-fund
ROLLUP_VER="$(node -p "require('rollup/package.json').version")"
TAURI_CLI_VER="$(node -p "require('@tauri-apps/cli/package.json').version")"
npm install \
  "@rollup/rollup-linux-x64-gnu@${ROLLUP_VER}" \
  "@tauri-apps/cli-linux-x64-gnu@${TAURI_CLI_VER}" \
  --no-save --no-audit --no-fund

echo "==> 开始 tauri 打包…"
node scripts/package-desktop-release.mjs

echo "==> 复制 release-packages 回 Windows 目录…"
mkdir -p "$WIN_ROOT/release-packages"
rsync -a "$BUILD_DIR/release-packages/" "$WIN_ROOT/release-packages/"

echo "==> Linux 打包完成"
