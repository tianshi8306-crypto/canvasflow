# Sidecar：ffmpeg（零依赖打包）

目标：让用户运行桌面端时**无需自行安装 ffmpeg**。

## 放置方式

把 ffmpeg 可执行文件放到本目录，并命名为：

- Windows：`ffmpeg.exe`
- macOS / Linux：`ffmpeg`

Tauri 会根据 `src-tauri/tauri.conf.json` 的 `bundle.externalBin` 在打包时将其作为 sidecar 一并带上。

> 当前仓库默认**不启用** `externalBin`，以保证在不提交 ffmpeg 二进制的情况下依然可以正常编译与开发。
> 发布/打包时由 CI 下载 ffmpeg 并启用 `externalBin`（或在打包前动态写入配置），即可实现用户侧零依赖。

## 一键打包（推荐）

仓库根目录执行：

- `npm run desktop:build:with-ffmpeg`

脚本会做：

1. 若 `src-tauri/bin/ffmpeg(.exe)` 不存在：下载并解压放入该目录（Windows x64 已内置下载源；其他平台需手动放置）
2. 临时修改 `src-tauri/tauri.conf.json`：启用 `bundle.externalBin=["bin/ffmpeg"]`
3. 调用 `tauri build`
4. 构建结束自动还原 `tauri.conf.json`

## 运行时策略（本项目约定）

后端调用 ffmpeg 时优先级：

1. `settings.json` 中的 `ffmpeg_path`（若填写且存在）
2. 应用内置 sidecar（本目录随包携带）
3. 系统 PATH 中的 `ffmpeg`（开发环境兜底）

> 注意：本仓库不直接提交 ffmpeg 二进制文件。发布时由 CI/打包脚本下载并放入本目录再构建。

