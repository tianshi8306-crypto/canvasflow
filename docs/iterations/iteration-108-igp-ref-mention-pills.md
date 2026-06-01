# 迭代 108 — 图片面板 @ 引用媒体 pill 闭环

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-29**  
> 状态：**✅ 已交付**  
> 路线图：[iter-106～110 P0](./iteration-106-110-igp-p0-roadmap.md)  
> 前置：**iter-106**（参考条）  
> 真源：iter-98 视频闭环、`VideoPromptRefChip`、`video-prompt-mention--compact`

## 1) 本轮目标（一句话）

在图片 prompt 区建立 **「参考条 ↔ @ 列表 ↔ 媒体 pill」** 闭环：`@` 引用上游参考图时渲染 **带缩略图的小 pill**，并与参考条序号双向高亮（对齐视频 iter-98）。

## 2) 变更范围（最多 3 个模块）

- `ImageGenerationPanel.tsx` + 新建 `ImagePromptMentionInput.tsx`（或扩展 `MentionInput` 图片专用 wrapper）
- `MentionInput.css` / `MinimalImageNode.css`（`.image-prompt-mention--compact`；pill 内 `.nodeThumb` 重置）
- 参考条组件（iter-106）与 prompt token 解析（`@图N` / 节点 label 策略与图片域一致）

## 3) 功能清单（2～4 项）

- **媒体 pill**：`@` 选中参考图 → prompt 内 pill 高 ~18px、thumb 14×14（expanded 可 9×9 compact）、radius 6px、11px 文案；`#风格` pill 仍可无 thumb
- **@ 列表 hover 预览**：dropdown 行 hover → 大图 Portal（复用 iter-106 hover 逻辑，max ~280px）
- **双向联动**：点击 pill → 参考条对应项选中描边；参考条单击（非 Shift）→ 驱动选中态（Shift+单击插入 `@`，与视频 iter-98 手势一致）
- **序号一致**：pill 标签、参考条 badge、`referenceImagePaths` 索引三者一致

## 4) 非目标（本轮不做）

- Seedance 合规蓝勾（图片无等价 API 则不做假勾）
- 创作模式 Tab 逻辑（iter-107）
- 视频/音频上游 @（图片节点 prompt 仅 image ref）
- Focus Preview 大条（视频式面板内顶图）；本轮仅 hover pop + pill thumb
- 状态轨、生成胶囊（iter-109/110）

## 5) 验收步骤（3～5 步）

1. 连 2 张参考图，prompt 输入 `@`：列表 hover 行出现大图；选中后 prompt 为 **带缩略图 pill**，非纯文字。
2. Shift+单击参考条 → 插入 `@图N`；序号与条上 badge 一致。
3. 单击 prompt 内 pill → 参考条对应项高亮；再单击参考条另一项 → pill 选中态同步（若产品定义为单选预览）。
4. 长 prompt 多 pill 时行高可控（pill ≤28px 轨道），无整块插图撑破正文。
5. `npm run test -- ImagePromptMention imagePromptAtTokens`（新增则写）+ `typecheck` 通过。

## 6) UI/UX

- **关键界面**：`ImageGenerationPanel` prompt 区、参考条、@ dropdown Portal
- **关键状态**：无 @ / 有 @ 未选中 / pill 选中 ↔ 条选中；dropdown 开/关
- **键盘与焦点**：`@` 列表 ↑↓ Enter Esc；pill 不阻断 textarea 编辑
- **本轮 UI 非目标**：不改 slash `/` 预设面板；不改 `#风格` token 语法

## 7) 风险与回退

- **主要风险**：全局 `.mention-pill` / `.nodeThumb` 污染 pill 布局（下半黑边、contain 留白）
- **触发条件**：pill 无图、序号错位、双层 hover 浮层遮挡
- **回退动作**：恢复通用 `MentionInput` 纯文字 `@` token
- **回退后保留**：prompt 样例、连线图、录屏

## 8) 完成定义（DoD）

- 验收 1～5 通过
- `gen-panel-design-system.md` §5 图片「@ 媒体 pill」列标记 ✅
- 与 iter-98 视频闭环验收项 3～5 图片域等价
