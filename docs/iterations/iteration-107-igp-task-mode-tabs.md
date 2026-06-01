# 迭代 107 — 图片面板创作模式 Tab

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-29**  
> 路线图：[iter-106～110 P0](./iteration-106-110-igp-p0-roadmap.md)  
> 真源：`videoPanelLibtvSections.ts` Tab 模式、`detectImageTask` / `ImageTaskMode`

## 1) 本轮目标（一句话）

将图片面板顶栏从 **「风格 / 标记 / 只读 meta」** 为主，调整为 **LibTV 式可扫读创作模式 Tab**（文生图 / 图生图 / 多图融合 / 图像编辑），任务模式可识别且可手动切换（对齐视频 workflow Tab 心智）。

## 2) 变更范围（最多 3 个模块）

- `ImageGenerationPanel.tsx`（顶栏结构：Tab 行 + 右侧 chrome 钮；风格/标记 reposition）
- `lib/imageGeneration/detectImageTask.ts` + 节点 data（`imageTaskMode` 或等价 draft 字段：手动锁定 vs 拓扑推断）
- `MinimalImageNode.css`（IGP 顶栏 Tab 复用 `--igp-control-*`，视觉对齐 `.mmTab--compact`）

## 3) 功能清单（2～4 项）

- **Tab 集合**：`text_to_image` · `image_to_image` · `multi_ref_fusion` · `image_edit`（无上游 ref 时后三项 disabled 或点击提示连线）
- **自动推断 + 锁定**：默认 `detectImageTask(referenceImagePaths)`；用户点 Tab → 锁定模式（对齐视频 `workflowLocked`）；再点已锁定 Tab 可解锁回自动（行为与 iter-99 视频一致或文档说明差异）
- **风格 / 标记下沉**：保留能力但不占用创作模式 Tab 位——移入顶栏右侧 icon 区或 prompt 上方快捷行（**二选一**，本轮定一种）
- **与参考条联动**：切换 Tab 时更新 `blockReason`/warn 文案（如多图融合需 ≥2 ref）；iter-106 参考条随模式显示/隐藏规则文档化

## 4) 非目标（本轮不做）

- 参考条、`@` pill（iter-106/108）
- 底栏参数重组、张数 select 改造（P1）
- 图像编辑模式完整 agent 能力扩展（仅 UI 模式位 + 已有 `image_edit` 路径接线）
- 标记节点画布聚焦逻辑变更（`markedNodeId` 行为保持）

## 5) 验收步骤（3～5 步）

1. 无上游图：顶栏默认 **文生图** Tab active；图生图/多图融合 Tab disabled 或点击 toast「请先连接参考图」。
2. 连 1 张图：自动切 **图生图**（未锁定时）；点击 **文生图** Tab → 锁定文生图，生成时使用 0 ref（若产品允许）或 block 并提示。
3. 连 ≥2 张图：自动 **多图融合**；锁定 **图生图** 后仅使用首张 ref（与现有 agent 语义一致或显式 warn）。
4. **风格**、**标记**仍可用且不在 Tab 行占位；展开/钉住/关闭钮位置与视频顶栏一致（右侧 28×28）。
5. `npm run test -- detectImageTask`（若有模式锁定单测）+ `typecheck` 通过。

## 6) UI/UX

- **关键界面**：`ImageGenerationPanel` 顶栏；empty / default / expanded 三 layout 均一致
- **关键状态**：Tab active / inactive / disabled；locked 锁图标（可选，对齐 `.mmTabLock`）；edit 模式仅在有 edit intent 时 enabled
- **键盘与焦点**：Tab 钮可键盘聚焦；不与画布 Delete/Backspace 冲突
- **本轮 UI 非目标**：不改 Tab 文案为视频用语；不引入「参考视频」类 Tab

## 7) 风险与回退

- **主要风险**：手动 Tab 与 `resolveImageGenerationContext` 推断冲突导致生成参数错乱
- **触发条件**：锁定图生图仍送 4 张 ref；Tab 与 meta 方钮 duplicate 显示
- **回退动作**：恢复 `IgpTaskMetaTile` + 风格/标记顶栏左排布局
- **回退后保留**：各 Tab 下生成请求 payload 截图

## 8) 完成定义（DoD）

- 验收 1～5 通过
- 顶栏信息架构与 `gen-panel-design-system.md` §3.1 描述一致（创作模式 Tab 为主）
