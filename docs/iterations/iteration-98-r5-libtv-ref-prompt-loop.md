# 迭代 98 — R5 LibTV 参考–提示词交互闭环

> 层：**CanvasExperienceLayer**  
> 对齐：LibTV 1.2.4 `@` 引用、参考图 1–6（预览 / pill / @ 列表）  
> 更新：**2026-05-29**  
> **状态**：✅ 已交付（iter-98）
> 总览：[`VIDEO_PANEL_LIBTV_OPTIMIZATION.md`](../product/VIDEO_PANEL_LIBTV_OPTIMIZATION.md)

## 1) 本轮目标（一句话）

在视频生成面板内建立 LibTV 式 **「参考条 ↔ 预览 ↔ prompt」闭环**：Focus Preview、@ 列表 hover 大图、prompt 缩略图 pill。

## 2) 变更范围（最多 3 个模块）

- `VideoMultimodalInputPanel.tsx`（Reference Focus Preview、参考条选中态、section 合并）
- `VideoPromptMentionInput.tsx` + `videoPromptAtTokens.ts`（pill 缩略图、picker hover 预览）
- `VideoPromptAtPicker.css` / `MinimalVideoNode.css` / `global.css`（布局与动效）

## 3) 功能清单

- **Focus Preview**：展开/钉住 Portal 时，参考条 hover 或 click 选中 → 面板顶部显示参考大图（与节点成片预览分离）；无选中时该区域折叠或显示占位
- **@ picker hover 大图**：`video-at-picker__row` hover → 行左侧/上方 Portal 大图（复用 `mmThumbHoverPop` 尺寸逻辑，max ~280px）
- **prompt 缩略图 pill**：`@图片N` 等 token 渲染为「24px 缩略图 + 短标签」；点击 pill 高亮参考条对应项
- **参考条手势调整**：默认 **单击 = 选中/驱动 Focus Preview**；**Shift+单击** 或 thumb 内 `@` 钮 = 插入 token（保留效率，不抢 LibTV 主手势）

## 4) 非目标（本轮不做）

- 工作流 Tab 可锁定、`detectWorkflow` 修复（见 iter-99）
- 有成片后面板常驻、输出参数拆 pill（见 iter-99）
- 主体库蓝色盾牌、多帧 3×4 网格 preview（见 iter-100 或更后）
- 底部 Dock、新 Provider、Hermes 批量逻辑变更

## 5) 验收步骤

1. 选中视频节点，连线 ≥2 张参考图，展开面板：hover 参考条 → **200ms 内** Focus Preview 切换为对应大图。
2. 单击参考条（非 Shift）→ Focus Preview 锁定该图；参考条项有选中描边。
3. prompt 输入 `@`：列表 hover 某行 → 出现大图预览；选中后 prompt 内为 **带缩略图的 pill**，非纯文字。
4. Shift+单击参考条 → prompt 插入 `@图片N`（或等价 token）；pill 与参考条序号一致。
5. 点击 prompt 内 pill → 参考条对应项高亮，Focus Preview 同步。
6. `npm run typecheck` + `npm run test -- VideoPromptMentionInput videoPromptAtTokens` 通过。

## 6) UI/UX

- **关键界面**：`VideoMultimodalInputPanel`（`layout=portal|expanded`）、`VideoPromptMentionInput`
- **关键状态**：无参考 / 有参考未选中 / 参考选中 / pill 与条双向高亮；Focus Preview 空态不占 >48px
- **键盘与焦点**：`@` 列表仍支持 ↑↓ Enter Esc；Focus Preview 不抢 textarea 焦点
- **本轮 UI 非目标**：不改 Tab 只读行为；不改底栏参数 pill；不引入主体库盾牌

## 7) 风险与回退

- **风险**：Focus Preview 增加面板高度，compact 360px 更挤
- **触发**：Portal 被挤出视口、或 hover 预览与 picker 双层 pop 遮挡
- **回退**：移除 Focus Preview 与 pill 缩略图，恢复纯文字 pill + 单击插 `@`

## 8) 完成定义

- 验收 1～6 通过
- 参考图 2、3、5 对照 LibTV：pill 有图、@ 列表 hover 有大图、参考条驱动预览
