# iter-111 · Agent 消息内嵌预览 ✅

**层级**：CanvasExperienceLayer  
**前置**：iter-109 ContextStrip、iter-110 Ambient 任务轨  
**P1 归属**：Octo gap · 多模态表达（原路线图 Phase 3 iter-110）

## 1) 本轮目标

工具产出 image/video/audio 时，聊天气泡内 **可折叠缩略图/播放器**，闭合 errata §6.2「Agent 发图/音」UI 半条。

## 2) 变更范围

- `hermesChatMediaPreview.ts`、`HermesChatMediaPreview.tsx`
- `hermesChatHistory.ts`、`HermesDirectorTypes`、`composeExportTool`
- `hermesDirector.ts`、`hermesAgentLoop.ts`、`HermesSidebar`、`HermesFloatChatLines`

## 3) 功能清单

1. **显式 preview**：`HermesToolRunResult.mediaPreview`（compose.export 成片）。
2. **消息解析**：媒体类 tool 成功消息中的 `assets/…` 路径 → 预览。
3. **聊天气泡**：`<details>` 折叠预览；可选「在画布查看」（nodeId）。
4. **consult 纯文本不变**：仅 progress / tool 结果带 preview。

## 4) 非目标

- Composer 统一上传（→ iter-112 规划）
- 批量出图每镜缩略图网格
- consult 通道 unsolicited 发图

## 5) 验收

1. 导出成片成功 → 聊天 `✓` 行下方可展开视频预览。
2. 失败步 / 非媒体 tool → 无 preview 块。
3. `npm run test -- hermesChatMediaPreview`

## 6) UI/UX

- 缩略图 max-height 120px；折叠默认展开。
- 与 progress 文本同气泡，不另占整行 Job 块。

## 7) 回退

移除 preview 字段与 `HermesChatMediaPreview` 组件；消息仅文本。
