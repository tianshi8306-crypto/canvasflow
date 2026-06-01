# 第 10 轮执行单：脚本解析与分镜反馈（script-10-1B）

> **状态**：已完成（2026-05-21）  
> **依据**：[脚本节点开发顺序.md](../product/脚本节点开发顺序.md) 阶段 1-B  
> **依赖**：script-10-1A 入口收敛

## 1) 本轮目标（一句话）

解析/分镜失败与 0 条镜头结果可读，顶栏/底栏/全屏 busy 与 `isGraphRunning`、`data.status` 一致；创意视图可定位失败镜头。

## 2) 变更范围

- `src/lib/scriptNodeFeedback.ts` + 单测
- `src/hooks/useScriptNodeTaskState.ts`
- `ScriptComposerPanel`、`ScriptPreviewToolbar`、`ScriptNodeFullscreenOverlay`
- `ScriptCreativeViewGrid`、`ScriptBeatsEditorTable`（高亮定位）

## 3) 功能清单

- [x] `useScriptNodeTaskState`：`isGraphRunning` + 节点 `status` 统一 busy
- [x] 底栏/全屏内嵌反馈条（失败 / 0 条 / 执行中）
- [x] 解析完成文案统一 `scriptParseCompleteStatus`（含运行日志引导）
- [x] 创意视图失败卡片「定位镜头」→ 脚本表高亮行
- [x] 顶栏去掉独立 regen/storyboard busy，与图执行态对齐

## 4) 非目标

- WebSocket 真进度
- 重做工作台/全屏表

## 5) 验收步骤

1. 无 API Key 点「AI 解析」→ 底栏/状态栏错误文案，含运行面板提示。
2. 解析返回 0 条 → 状态栏 + 底栏 warn 引导改 prompt / 查 script_parse。
3. 解析中顶栏显示「解析中…」，与子图 `isGraphRunning` 一致，结束后恢复。
4. 分镜失败 → 创意视图卡片「定位镜头」→ 切脚本表并高亮对应行。
5. 分镜生成中顶栏「分镜中…」与节点 status（分镜 Agent）一致。

## 6) UI/UX

- 反馈条复用 `igp-feedback--block|warn|info` token。
- 高亮行/卡片 2.4s 后自动清除（可再次定位）。

## 7) 风险与回退

- **风险**：图执行结束瞬间仍显示 info 条。
- **回退**：移除 `useScriptNodeTaskState` 与反馈条，恢复顶栏本地 `busy` state。
