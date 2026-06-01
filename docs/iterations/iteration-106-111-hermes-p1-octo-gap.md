# Hermes P1 · Octo gap 核心（iter-108～111）

> **对齐**：[HERMES_SPIRIT_VISION_ERRATA.md](../product/HERMES_SPIRIT_VISION_ERRATA.md) §2026 优先级 2～3  
> **编号说明**：壳层 iter-106/107 与 ambient iter-110 已在并行开发中完成；本表仅列 **共感 + 多模态表达** 四迭代。

| iter | 主题 | 文档 | 状态 |
|------|------|------|------|
| **108** | 画布高亮 + 选中 ack | [iteration-108-hermes-canvas-highlight-feedback.md](./iteration-108-hermes-canvas-highlight-feedback.md) | ✅ |
| **109** | ContextStrip 短句 | [iteration-109-hermes-context-strip.md](./iteration-109-hermes-context-strip.md) | ✅ |
| **110** | Ambient 任务轨（壳层，与路线图 Phase 1 对调编号） | [iteration-110-hermes-ambient-job-track.md](./iteration-110-hermes-ambient-job-track.md) | ✅ |
| **111** | 消息内嵌媒体预览 | [iteration-111-hermes-message-media-preview.md](./iteration-111-hermes-message-media-preview.md) | ✅ |
| **112** | Composer 统一上传 | [iteration-112-hermes-composer-upload.md](./iteration-112-hermes-composer-upload.md) | ✅ |
| **113** | 规划期排队 | [iteration-113-hermes-planning-queue.md](./iteration-113-hermes-planning-queue.md) | ✅ |
| **114** | NL Job 取消 | [iteration-114-hermes-nl-job-cancel.md](./iteration-114-hermes-nl-job-cancel.md) | ✅ |

## P1 Octo gap 已闭合

并行体验线 iter-108～114 已全部交付。

## 验收命令

```bash
npm run test -- hermesNlJobCancel hermesPlanningMessageQueue hermesParallelChannel hermesCanvasHighlight hermesContextStrip hermesJobAmbient hermesChatMediaPreview hermesComposerUpload hermesPhase0Acceptance
```

## P1 成功标准（摘自路线图）

- **共感**：「改第 3 镜」→ 高亮 + strip + 短 ack，无 situation 墙  
- **Ambient**：关浮窗仍知 Job；开浮窗对话为主  
- **多模态**：成片/媒体 tool 成功 → 聊天内可展开预览  
