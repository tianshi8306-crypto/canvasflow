---
id: ai-video-full-pipeline-guide
category: creative
scene: workflow
tags: [AI视频, 全流程, 脚本, 分镜, 角色一致性, IP-Adapter, LoRA, ControlNet, 运镜, 图生视频, AnimateDiff, 节点流, ComfyUI, 后期, 上采样, 补帧]
---

# AI 视频全流程：从脚本到成片（行业实践摘要）

> 供 Hermes 顾问与规划参考；与 CanvasFlow **无限画布** 对照使用——用户可只做其中一段，不必跑完全链路。

## 标准链路（可裁剪）

```text
创意/梗概 → 结构化脚本 → 分镜脚本（镜号+画面+运镜+对白）
    → 角色/场景定稿（参考图、风格锚点）
    → 关键帧/底图（文生图或图生图）
    → 图生视频（I2V，2～10s/镜）
    → 配音/音乐/口型（可选）
    → 时间线剪辑、调色、导出
```

| 阶段 | 行业常见手段 | CanvasFlow 对应 |
|------|----------------|-----------------|
| 脚本 | LLM 结构化提示：大纲、人物、场景、情绪 | 脚本节点、梗概、`script.generate_outline` |
| 分镜 | 每镜：画面描述、景别、运镜、时长 | `storyboardShots`、`script.generate_storyboard` |
| 角色一致 | LoRA 训练；IP-Adapter / FaceID + 参考图；InsightFace | 角色圣经参考图、`bible.update`、镜头表参考图 |
| 场景/风格一致 | ControlNet（Canny/Depth/MLSD）；主镜风格参考；区域提示 | 分镜 visualPrompt、多图参考节点 |
| 动作/时序 | AnimateDiff；OpenPose/DWPose；TemporalNet 减闪烁 | 图生视频 motion prompt、`film.shot_to_video_prompt` + `useMotionTemplate` |
| 运镜 | 提示词（zoom/pan/dolly/低角度）；CameraCtrl / Motion LoRA | video 节点 `draft.prompt`、批量参数 |
| 节点流 | ComfyUI：Checkpoint → CLIP → AnimateDiff → ControlNet → KSampler → VAE | 画布节点+连线；Hermes `chain.spawn_media_nodes` |
| 后期 | Topaz/Magnific 超分；RIFE/DAIN 补帧；局部修脸手 | 时间线导出 `compose.export_script`；失败镜 `video.retry_failed` |

## 1. 脚本与创意

- **结构化提示** 优于一句空话：人物关系、场景、情绪、目标时长、画幅。
- 产出物：**剧本大纲** + **分镜表**（镜号、画面、运镜、台词/旁白）。
- Hermes：用户只说灵感时，可先顾问补结构，再询问是否生成镜头表；勿默认必须建脚本节点（见 `nonlinear-canvas-production.md`）。

## 2. 角色一致性（高频难点）

| 手段 | 适用 | 注意 |
|------|------|------|
| **LoRA** | 固定主角、多镜大量复用 | 需训练素材；成本高、效果最好 |
| **IP-Adapter / FaceID** | 参考图锁脸，免训练 | 参考图质量决定上限；多脸场景易串 |
| **固定触发词/角色名** | 轻量锚定 | 仍可能漂移，需抽卡筛选 |
| **InsightFace 等** | 高保真面部 | 与参考图管线配合 |

**制片建议**：先定 1～3 张「角色标准参考」，再批量出分镜图；改人设时同步更新圣经与参考图，再重出受影响镜的关键帧。

## 3. 场景与风格一致性

- **ControlNet**：Canny（线稿结构）、Depth（空间深度）、MLSD（建筑线条）保持布景不变。
- **主镜（Master Shot）**：用一张确立光影/色调，后续镜 style 参考。
- **区域提示**：避免人物与背景元素「糊在一起」。

CanvasFlow：在分镜 `visualPrompt` 写清场景锚点；同场戏保持英文/中文关键词一致。

## 4. 动作、姿态与时序稳定

- **AnimateDiff** 类：图/ latent 序列动画核心。
- **OpenPose / DWPose**：从参考视频抽骨骼，驱动角色动作。
- **TemporalNet**：减轻帧间闪烁、纹理抖动。

图生视频提示词：遵循 **1 主运动 + 1 辅运动 + 情绪 + 结束态 + 镜头**（详见 `video-character-motion-prompt.md`）。避免叠加强烈冲突运动词（见 `troubleshoot/seedance-common.md`）。

## 5. 镜头语言与运镜

常用英文/中文关键词（写入 video prompt）：

| 意图 | 提示示例 |
|------|----------|
| 推近 | slow dolly in, zoom in gradually |
| 拉远 | pull back, zoom out |
| 横摇 | pan left/right, tracking shot |
| 跟拍 | follow shot, steadicam |
| 低角度 | low angle, heroic shot |
| 稳定 | smooth camera, no shake |

专用模块（ComfyUI 生态）：CameraCtrl、Motion LoRA——CanvasFlow 侧用 Seedance 等 API 时，把运镜写进 `draft.prompt`，勿编造 API 不支持的参数。

## 6. 节点流思维（与画布对照）

典型 ComfyUI 链：**Load Checkpoint → CLIP Text Encode →（AnimateDiff Loader）→ ControlNet Apply → KSampler → VAE Decode**。

- 可 **分支**：角色支路、动作支路、背景支路，再合并——对应画布上「分镜 → 多图节点 → 多视频节点」。
- **先低分辨率预览**，运动满意后再超分/精修——对应：先单镜短视频试跑，再批量。

Hermes 断链检查：`film.workflow_check`；缺 video 节点先 `chain.spawn_media_nodes`。

## 7. 后期与增强

| 环节 | 工具类型 | 制片要点 |
|------|----------|----------|
| 超分 | Topaz Video AI、Magnific | 运动定稿后再做，避免放大瑕疵 |
| 补帧 | RIFE、DAIN | 8fps→24/60fps，减轻卡顿感 |
| 局部修复 | Tile ControlNet、Inpainting | 脸、手、字幕区 |

导出：确认各镜时长、画幅统一后再 `compose.export_script`。

## 8. 专家策略（Hermes 口吻）

1. **Script-First 可选**：完整短片先脚本/分镜；单镜实验可跳过脚本，直接图生视频。
2. **勿 over-prompt**：提示词过长、运动词冲突会导致崩坏；单镜一条主运动。
3. **迭代**：预览 → 调整分镜/参考图/prompt → 再批量；失败用 `image.retry_failed` / `video.retry_failed`。
4. **权重与参考**：多参考图时说明主次（角色脸 > 服装 > 场景）。
5. **非线性画布**：用户停在「后期」或「只出一张图」都合法；建议对齐其 **当前节点** 而非整条流水线。

## 反例 / 正例

| 反例 | 正例 |
|------|------|
| 「你先做个完整短剧流程」 | 「你这镜已有分镜图，要写人物动作 prompt 还是直接重试视频？」 |
| 编造 Seedance 不存在的 CameraCtrl 参数 | 「在视频节点用英文写 slow pan + 主体动作」 |
| 缺参考图却要求多镜同一人不变 | 「先上传角色默认参考图或训练 LoRA，再批量出图」 |

## 相关条目

- `nonlinear-canvas-production.md` — 何时主动建议
- `video-character-motion-prompt.md` — 图生视频动作模板
- `storyboard.md` / `script-beats.md` — 分镜与镜头表
- `models/seedance-params.md` — 模型参数真源
