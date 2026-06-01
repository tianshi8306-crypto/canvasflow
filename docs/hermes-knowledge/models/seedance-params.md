---
id: model-seedance-params
category: models
tags: [Seedance, 参数, 时长, 分辨率, 多模态]
---

# Seedance 参数与多模态上限（CanvasFlow）

> **代码真源**：`src/lib/seedance/validation.ts`、`src/lib/videoNodeTypes.ts`。  
> 提示词写法见同目录 `seedance.md`。

## 单镜生成输出（videoNode.params / draft）

| 参数 | 允许范围 | 说明 |
|------|----------|------|
| durationSec | **4～15** 秒 | Hermes `film.batch_set_video_params` 与此一致 |
| aspectRatio | 16:9、9:16、1:1、4:3、3:4、21:9 | 短剧竖屏常用 9:16 |
| resolution | 720P、1080P | 与设置里模型能力一致 |

## 多模态参考输入（@ 语法）

| 类型 | 上限 | 单文件大小 |
|------|------|------------|
| 图片 jpeg/png | **≤9** 张 | < 30MB |
| 视频 mp4/mov | **≤3** 个 | < 50MB；单段 2～15s |
| 音频 mp3/wav | **≤3** 个 | < 15MB；总长 ≤15s |
| 合计文件数 | **≤12** | 含图+视+音 |

## @ 引用（prompt 内）

- 索引：`@图1` `@视频1` `@音频1`（1-based，与连线参考列表顺序一致）
- 文件名：`@hero.png`（含扩展名）
- **连线强制匹配**（无扩展名也可）：`@背景音乐` 匹配 `背景音乐.mp3`；源节点**标签**；分镜**镜号**
- 解析：`src/lib/seedance/promptBuilder.ts` + `videoPromptAtTokens.ts`（生成时合并上游标签）
- Hermes `film.shot_to_video_prompt` 可写纯文本；批量出视频前会同步上游图到 `reference*Paths`。若写 `@图1` 须已连线

## Hermes 批量写入

- 工具：`film.batch_set_video_params`（durationSec、aspectRatio、resolution）
- 写回：`videoNode.data.video` 下 draft + params
- 批量出视频前建议先 `film.shot_to_video_prompt` 填满 `draft.prompt`

## 与分镜状态

- `storyboardShots[].videoStatus === "failed"` → 用 `video.retry_failed` 或工作台「重试失败视频」
- 缺 prompt → 先 `film.shot_to_video_prompt`，勿直接重复提交 API
