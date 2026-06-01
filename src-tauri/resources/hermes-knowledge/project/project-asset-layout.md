# 工程素材目录规范

> **用途**：供 Hermes 理解工程内素材落盘位置与引用方式（知识能力，非可调用工具）。  
> **维护**：与 `project_asset_store.rs` 真源同步。

## 目录原则

工程根目录下 `assets/` 以**媒体类型**为第一级，再区分来源：

```
assets/
├── video/
│   ├── import/          # 用户导入/拖入
│   └── gen/
│       ├── dreamina/    # 即梦 CLI/API 视频
│       ├── seedance/    # Doubao Seedance API
│       ├── mock/        # 本地 mock
│       └── tools/       # 裁剪、去字幕等 FFmpeg 输出
├── image/
│   ├── import/
│   └── gen/
│       ├── generate/    # 图片 API
│       └── dreamina/
├── audio/
│   ├── import/
│   └── gen/
│       ├── tts/
│       └── tools/       # 音轨提取
├── exports/             # 时间线导出
└── export/              # 组导出
```

## 路径示例

| 场景 | 相对路径 |
|------|----------|
| 导入视频 | `assets/video/import/clip.mp4` |
| Seedance 成片 | `assets/video/gen/seedance/seedance_gen_20260530_….mp4` |
| 即梦成片 | `assets/video/gen/dreamina/dreamina_t2v_….mp4` |
| TTS | `assets/audio/gen/tts/tts_….mp3` |

## 索引与引用

- 素材 UUID 与 `rel_path` 登记在 `.canvasflow/runs.db` 的 `assets` 表。
- 画布节点优先用 `assetId`；仅有 `path` 时打开工程会自动 backfill。
- 节点、分镜中的 `path` 字段必须是上述相对路径。

## 旧工程整理

若存在 `assets/*.mp4`（根目录扁平）或旧版 `assets/gen/video/…`、`assets/import/image/…`：

- 用户在 **设置 → 常规 → 工程素材目录** 执行「预览整理 / 整理素材目录」。
- Hermes **不应**自行移动文件；可提示用户去设置页整理，或说明目标路径规范。

## 给 Agent 的提示

- 引用素材时用 `assetId` 或规范 `rel_path`，不要假设文件仍在 `assets/` 根目录。
- 新生成/导入会自动写入类型子目录；无需手动建文件夹。
- 导出成片与时间线输出在 `assets/exports/`，与生成素材分开。
