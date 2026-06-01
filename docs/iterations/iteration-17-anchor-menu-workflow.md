# 第 17 轮：锚点引入/引出菜单与工作流对齐

> **状态**：已完成（2026-05-21）  
> **层级**：CanvasExperienceLayer  
> **真源代码**：`src/lib/nodeAnchorMenus.ts`、`src/lib/nodeAnchorMenuAvailability.ts`、`src/lib/flowConnectionPolicy.ts`

---

## 目标

锚点菜单（左侧引入 / 右侧引出）与生产链路 **文本 → 脚本 → 图/音 → 视频 → 合成** 一致，且菜单项在点击前即可用。

## 分阶段

| 阶段 | 内容 |
|------|------|
| **P0** | `isConnectionAllowed` 过滤非法类型；文本引入脚本可新建；视频 extra（首尾帧）；取消 RF `translate` 甩点 |
| **P1** | 文案统一；工作流排序；脚本 extra「LLM」；合成仅视频引入；`llm` 可 spawn |
| **P3** | **图状态过滤**：已有脚本上游、已有 text↔video/audio 等不再展示重复项；排除 script↔script、text↔text |

## 菜单规则摘要

- **引入**：伙伴类型 → 当前节点，且通过 `nodeAnchorMenuAvailability` 图状态检查。
- **引出**：当前节点 → 下游类型，同上。
- **Extra**（不占创建槽）：视频首尾帧向导、音频 TTS 面板、图片图生图、脚本 LLM。

## 验收

1. 图片节点已连脚本时，引入菜单无第二项「脚本」。
2. 文本已连视频时，引出无第二项「视频」。
3. 脚本引入无「脚本」自环；音频引入无「图片」。
4. 视频节点引入含：图/视/音/文/剧 + 首尾帧两项。
5. Magnetic 与 Simple 锚点标题均为「添加上游输入 / 引出输出」。
6. 锚点菜单行图标与右键「添加节点」一致（`canvasMenuNodeIcons` + `.canvasPaneCtxMenu__icon`）。

## Out of scope

- 空白处右键「添加节点」面板与锚点菜单完全合并（仍走 `CanvasContextMenus`）。
- 拖线到空白后 `openAddPanelAt` 的节点 id 定向过滤（`menuState.nodeId` 未接）。

## 回滚

还原 `nodeAnchorMenus.ts` / `nodeAnchorMenuAvailability.ts` 及 `SimpleAnchors` / `MagneticNodeAnchors` 的 ctx 传参。
