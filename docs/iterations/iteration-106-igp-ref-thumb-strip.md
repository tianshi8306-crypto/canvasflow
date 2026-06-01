# 迭代 106 — 图片面板参考图条（LibTV §3.2）

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-29**  
> **状态**：✅ 已交付（iter-106）  
> 真源：[`gen-panel-design-system.md`](../design/gen-panel-design-system.md) §3.2、`VideoMultimodalInputPanel` `mmToolsAndThumbs--compact`

## 1) 本轮目标（一句话）

在图片生成参数面板内，当存在上游参考图时渲染 **与视频对齐的参考缩略图条**（无参考时不占位），替代当前只读 `IgpTaskMetaTile` 文字块。

## 2) 变更范围（最多 3 个模块）

- `ImageGenerationPanel.tsx`（插入参考条分区；有 ref 时隐藏或降级 meta 方钮）
- 新建或抽取 `ImageRefThumbStrip.tsx`（复用 `NodeMediaPreview`、序号 badge；样式 scoped 到 IGP）
- `MinimalImageNode.css`（`.imageGenPanel--minimal` 下 ref strip token：`--gen-ref-thumb-size/gap`）

## 3) 功能清单（2～4 项）

- **条件渲染**：`referenceImagePaths.length > 0` 时渲染横条；**禁止**「暂无参考图」占位（与 VGP 一致）
- **缩略图规格**：37×37、`object-fit: cover`、白底卡片 + 浅描边、右上序号；gap 4px；与顶栏/正文 **左对齐**（仅面板 14px padding，条带无独立暗底）
- **基础交互**：hover 单图 Portal 预览（锚定 thumb 上方，复用 `refPreviewUtils` 尺寸逻辑）；条内删除/排序 **本轮可 stub 或仅删除**（排序见非目标）
- **滚动渐隐**：隐藏左侧 `::before` 渐变；右侧 `::after` 用 `var(--gen-panel-bg)`

## 4) 非目标（本轮不做）

- prompt 内 `@` 媒体 pill、参考条 ↔ pill 双向高亮（iter-108）
- 创作模式 Tab 可切换（iter-107）
- 参考条拖拽排序、多图融合上限 UI（>4 张）专项
- 视频/音频/文本类上游 ref（图片节点仅 image ref）
- 状态轨、生成中胶囊（iter-109/110）

## 5) 验收步骤（3～5 步）

1. 空态图片节点展开底栏：顶栏无「参考」meta 块，**无**参考条区域，面板高度不预留空条。
2. 上游连 1～4 张图到图片节点，展开底栏：参考条出现，缩略图 **cover 铺满**，序号 1…N 与 `collectIncomingImageRefs` 顺序一致。
3. hover 某 thumb → ~200ms 内出现大图预览 Portal，不遮挡 prompt 输入焦点。
4. 参考条左缘与「风格/标记」按钮左缘对齐（目测 ±2px）；条带背景与面板 `#2b2b2b` 同色，无独立灰盒。
5. `npm run typecheck` 通过；若有 strip 单测则 `npm run test -- ImageRefThumbStrip` 通过。

## 6) UI/UX

- **关键界面**：`ImageGenerationPanel` Portal / 展开 Modal；参考条位于顶栏与 prompt 之间
- **关键状态**：0 ref / 1 ref / 多 ref；hover 预览 / 无预览；加载失败 thumb 占位（muted icon，不 crash）
- **键盘与焦点**：参考条不抢 `MentionInput` 焦点；thumb 可 `Tab` 聚焦时 Enter 触发预览（可选）
- **本轮 UI 非目标**：不改底栏模型/比例/张数布局；不改 `#风格` popover

## 7) 风险与回退

- **主要风险**：Portal 面板 `overflow: hidden` 裁切 hover 预览；thumb 与全局 `.nodeThumb` 样式冲突
- **触发条件**：有 ref 但条不显示；thumb 底部黑边（contain）；条带与 Tab 区不对齐
- **回退动作**：移除 strip 组件，恢复 `IgpTaskMetaTile` 只读展示
- **回退后保留**：截图 + 上游连线拓扑 + `referenceImagePaths` 控制台日志

## 8) 完成定义（DoD）

- 验收 1～5 通过
- `gen-panel-design-system.md` §5 图片「参考条」列更新为「部分实现（条带）」
- iter-108 可在此基础上接 `@` pill
