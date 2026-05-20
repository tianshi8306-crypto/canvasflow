# 视频节点 Chrome 二期设计（对齐 LibTV 使用指南）

> **版本**：1.0  
> **日期**：2026-05-19  
> **对齐章节**：LibTV 1.2.4 视频节点、2.3 视频工具、Canvas Node Chrome Spec §7  
> **形态约束**：不采用 LibTV 底部 Dock；顶栏 Portal + 底栏 `VideoMultimodalInputPanel`（见 `LIBTV_GUIDE_ALIGNMENT.md`）

---

## 1. 本轮目标（一句话）

在已完成 P0 交互修复基础上，**补齐 LibTV 式预览顶栏可见性与工程持久化**，并为 2.3 视频工具建立可演进的数据驱动 action 层（可见 stub + 下拉占位 + 下载另存为）。

---

## 2. LibTV 对照摘要

| LibTV（指南归纳） | CanvasFlow 形态 | 本轮 |
|-------------------|-----------------|------|
| 1.2.4 上传 + 视频模型 + `@` 引用 | 空态上传钮、右上上传、底栏 Portal、`useVideoIncomingReferenceItems` | **已有**；本轮不重复 |
| 1.2.4 预览上缘工具条 | `VideoPreviewToolbarPortal` + 胶囊条 | **恢复显示** 剪辑/高清/解析/去字幕/音频分离 |
| 2.3 视频高清 | 云端超分 API | **stub** + 状态栏说明 |
| 2.3 解析 | 多模态理解 / 脚本参考视频 | **stub**；远期接 scriptNode + Agent |
| 2.3 剪辑 | 时间线裁剪 | **stub**；远期接 `ffmpegConcat` / 时间线导出 |
| 2.3 合成 | 多段拼接 | **`ffmpegConcat` 节点已有**；顶栏不重复入口 |
| 预览外 名称+序号 | `NodeMetaLabel` 整条 `视频 N` | **P0 已完成** |
| 下载 / 展开 | 右侧图标 | **下载→系统另存为**；展开→`videoGenPanelExpandedNodeId` |

---

## 3. 空间与显隐（与图片一致）

沿用 `canvas-node-chrome-spec.md`：

- **左上**：`NodeMetaLabel`（`视频 1` 可编辑）
- **右上**：`NodeMetaStatus`（分辨率 / 生成中 N%）
- **预览上**：`VideoPreviewToolbar`（仅 `hasPath && expandedChrome`）
- **预览内**：`VideoMinimalPlayer` + 右上上传
- **预览下**：`VideoGenerationPanelPortal`（空态或钉住）

**禁止**：预览占位区点击上传（避免与拖节点冲突）。

---

## 4. 顶栏 Action 设计（数据驱动）

文件：`src/lib/videoPreviewToolbarActions.ts`

| id | 标签 | kind | 行为（本期） |
|----|------|------|----------------|
| `clip` | 剪辑 | menu | **单段裁剪**：预览区入出点 + FFmpeg 导出；**多段合成**：右侧 `ffmpegConcat` |
| `hd` | 高清 | workflow | 预填「参考视频」草稿 + 1080P + 提示词种子，钉住底栏生成面板 |
| `parse` | 解析 | workflow | 同上（解析向提示词）；有上游脚本时状态栏提示对照分镜 |
| `subtitle` | 智能去字幕 | menu | **自动去除**：参考视频 + 提示词；**框选去除**：选框 + FFmpeg delogo 替换成片 |
| `audioSplit` | 音频分离 | menu | 下拉：提取人声 / 提取背景音乐（均为 stub） |
| `download` | 下载 | utility | Tauri `save` 对话框另存工程内视频 |
| `maximize` | 展开 | utility | `setVideoGenPanelExpandedNodeId` |

**UI**：与参考图一致——主区横向 Chip + 带 `▾` 的菜单项；右侧图标区分隔。

**二期 b（2026-05-19）**：

- `audioSplit` → **提取人声**：FFmpeg 导出混合音轨 → 左侧 `audioNode` + `assets/`（诚实提示：AI 人声/伴奏分离待接）
- **提取背景音乐**：后端返回说明，待 AI 模型

**仍待接**：

- `hd` / `parse` / `subtitle-auto` → 专用解析/超分/去字幕 API（当前为参考视频重生成入口）
- `audioSplit` → **提取背景音乐**（不做）

---

## 5. 工程持久化：节点序号计数器

**问题**：`imageNodeCounter` / `videoNodeCounter` 仅内存；重开工程靠扫描 label 正则恢复，粘贴/多 Tab 可能漂移。

**方案**（不升 canvas version，扩展 v2 可选字段）：

```json
{
  "version": 2,
  "viewport": { ... },
  "nodes": [ ... ],
  "edges": [ ... ],
  "meta": {
    "imageNodeCounter": 3,
    "videoNodeCounter": 2
  }
}
```

- `serializeCanvas(..., meta)` 写入 `meta`
- `parseCanvas` 返回 `meta`；`openProject` 优先采用 `meta`，缺省时回退 label 扫描
- 新建工程 `meta` 归零

---

## 6. 其它补齐

| 项 | 说明 |
|----|------|
| 粘贴副本 | `buildPasteNodesFromClipboard`：`videoNode` 同图片加 ` 副本` 后缀 |
| 文档 | 更新 `canvas-node-chrome-spec.md` 视频行；`LIBTV_GUIDE_ALIGNMENT` 视频顶栏→部分 |
| 测试 | `serialization.test` meta 往返；`videoPreviewToolbarActions` 配置快照（可选） |

---

## 7. 非目标（本轮不做）

- 真实 FFmpeg 音频分离 / 剪辑时间线
- 视频高清 API 对接
- 底栏多 Tab 生成器重构（文生视频 / 图生视频分 Tab）
- `canvasflow.json` version 升至 3
- Hermes 批量视频生成逻辑变更

---

## 8. 验收步骤

1. Tauri 打开工程，新建 2 个视频节点 → 标签 `视频 1`、`视频 2`；保存并重开 → 再新建为 `视频 3`（计数器持久化）。
2. 有视频且单选 → 顶栏显示剪辑/高清/解析/去字幕/音频分离；点 stub 有状态栏提示；去字幕/音频分离可展开子项。
3. 下载 → 弹出另存为，选定路径后文件可播放。
4. 展开 → 打开视频生成大窗；Esc 关闭。
5. 复制视频节点粘贴 → 标签含「副本」。

---

## 9. 回退

- 移除 `meta` 读写（仍可用 label 扫描）
- 恢复顶栏仅 download/expand（过滤 stub）

---

*维护：视频 Chrome 行为变更须同步本文与 `canvas-node-chrome-spec.md`。*
