# 应用自动更新（GitHub Release）

CanvasFlow 使用 Tauri `tauri-plugin-updater` + GitHub Release 静态 `latest.json` 分发**增量更新包**。

## 客户端行为

- **触发**：桌面版启动后联网检查 **一次**
- **无网**：静默跳过，不弹窗
- **有新版本**：弹窗提示，用户可 **下载并更新** 或 **稍后提醒**
- **稍后提醒**：跳过当前版本（写入 `localStorage`），下次启动不再提示该版本
- **安装**：下载签名增量包 → 退出当前进程 → 安装 → **自动重启**

更新源：`https://github.com/tianshi8306-crypto/canvasflow/releases/latest/download/latest.json`

## 发版前准备（一次性）

1. 生成签名密钥（已在仓库根目录 `.tauri/` 生成过公钥；私钥勿提交）：

   ```bash
   CI=true npx tauri signer generate -w .tauri/canvasflow.key -f --ci
   ```

2. 将 `tauri.conf.json` 中 `plugins.updater.pubkey` 设为 `.tauri/canvasflow.key.pub` 第二行公钥。

3. 在 GitHub Actions / 本地发版环境配置 Secret：

   - `TAURI_SIGNING_PRIVATE_KEY`：私钥文件内容或路径
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：若私钥有密码则填写

## 每次发版

1. bump `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 版本号一致。
2. 设置签名私钥环境变量后构建：

   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw .tauri/canvasflow.key
   npm run desktop:build:with-ffmpeg
   ```

3. 构建产物中会包含各平台 `.sig` 与增量包（如 Windows `.nsis.zip`、macOS `.app.tar.gz`、Linux `.AppImage.tar.gz`）。
4. 创建 GitHub Release，上传增量包与 `latest.json`（可参考 `scripts/releases/latest.json.example`）。
5. `latest.json` 必须包含当前 Release 涉及的全部平台条目；`signature` 字段为对应 `.sig` 文件**全文**。

推荐使用 [tauri-apps/tauri-action](https://github.com/tauri-apps/tauri-action) 自动生成 `latest.json` 并上传到 Release。

## GitHub Actions 自动发版

Workflow：`.github/workflows/release.yml`

### 触发方式

1. **打 tag 推送**（推荐）  
   - 先将 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 版本号改为同一值（如 `0.2.0`）  
   - 提交后：`git tag v0.2.0 && git push origin v0.2.0`  
   - tag 去掉前缀 `v` 后必须与 `tauri.conf.json` 的 `version` 一致

2. **手动触发**  
   - GitHub → Actions → Release → Run workflow  
   - 填写 tag（如 `v0.2.0`），需该 tag 已存在且指向含正确版本号的提交

### 流程说明

1. 跑 `quality:gate`（typecheck + lint + 单测 + Rust 测试）  
2. 四平台矩阵构建：Windows / Ubuntu / macOS (x64 + arm64)  
3. 各 job 执行 `node scripts/tauri-build-with-ffmpeg.mjs --ci-prep` 打包 ffmpeg  
4. `tauri-action` 构建签名增量包、安装包，并上传 `latest.json` 到 GitHub Release

### 必填 Secrets（Repository → Settings → Secrets）

| Secret | 说明 |
|--------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | `.tauri/canvasflow.key` 全文或路径 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码；无密码可留空字符串 |

`GITHUB_TOKEN` 由 Actions 自动提供，无需配置。

### 发版后验证

1. Release 页应出现 `latest.json` 与各平台 `.sig` / 增量 zip / 安装包  
2. 安装上一版本桌面应用，联网启动，应弹出更新提示  
3. 完成更新后版本号与 tag 一致

## 手动发版（备用）

若不用 Actions，可本地执行「每次发版」1–5 步，再手动上传 Release。

## 验证

1. 安装旧版本桌面包并启动（需联网）。
2. 应弹出「发现新版本」对话框。
3. 点击「下载并更新」后应用退出、安装并自动重启为新版本。
