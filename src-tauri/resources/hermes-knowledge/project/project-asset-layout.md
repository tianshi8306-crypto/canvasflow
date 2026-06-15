# 工程素材目录规范

> **用途**：供 Hermes 理解工程内素材落盘位置与引用方式（知识能力，非可调用工具）。  
> **维护**：与 `project_asset_store.rs` 真源同步。

## 目录原则

工程根目录下 `assets/`：**图片与视频**使用扁平序号目录（不区分模型来源），**音频**仍按来源子目录：

```
assets/
├── video/               # 全部视频：000001.mp4、000002.mp4 …
├── image/               # 全部图片：000001.png、000002.jpg …
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
| 导入视频 | `assets/video/000001.mp4` |
| 生成视频（任意模型） | `assets/video/000002.mp4` |
| 生成图片 | `assets/image/000001.png` |
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
