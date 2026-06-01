# 迭代 110 — 图片面板生成中胶囊与停止

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-29**  
> 状态：**✅ 已完成**  
> 路线图：[iter-106～110 P0](./iteration-106-110-igp-p0-roadmap.md)  
> 前置：建议 **iter-109**（停止与状态轨文案一致）  
> 真源：`VideoGenerationCenterCapsule.tsx`、`IgpGenerateButtonIcon`

## 1) 本轮目标（一句话）

图片生成进行中时，在面板内提供 **与视频对齐的居中胶囊遮罩 + 停止**，避免仅底栏图标变化、用户不知任务在进行或如何取消。

## 2) 变更范围（最多 3 个模块）

- `ImageGenerationPanel.tsx`（`isGenerating` 时渲染 capsule overlay；停止接现有 cancel token / agent cancel）
- 新建 `ImageGenerationCenterCapsule.tsx` 或复用 `VideoGenerationCenterCapsule`（文案改为「正在生成图片…」）
- `MinimalImageNode.css`（`.imageGenPanel--minimal.mmPanel--generating` 对齐 VGP 遮罩 z-index；pointer-events）

## 3) 功能清单（2～4 项）

- **居中胶囊**：生成中面板内容区半透明遮罩 + 胶囊（进度文案 + **停止** 钮）；参考条/prompt 不可误触
- **双入口停止**：胶囊停止与底栏 `igp-generate-btn.generating` 点击均触发同一 cancel 路径
- **取消后状态**：停止 → 状态轨「已取消」或 idle（iter-109 rail 接文案）；可再次生成
- **进度文案**：复用 `useNodeStatus` / `imageGenProgress` 已有百分比或阶段文案（若无则「生成中…」）

## 4) 非目标（本轮不做）

- 参考条 / @ pill / Tab（iter-106～108）
- 新 Rust cancel API（仅接现有前端 cancel token）
- 节点壳预览区进度（外置 meta 进度条保持）
- 批量多 job 并发 UI

## 5) 验收步骤（3～5 步）

1. 点击生成 → 500ms 内出现居中胶囊，底栏钮为停止态；面板内 prompt/参考条不可编辑。
2. 点击胶囊「停止」→ 请求中断，胶囊消失，状态轨提示已取消或就绪。
3. 点击底栏停止钮 → 与胶囊等价，不重复触发两次 cancel。
4. 生成成功 → 胶囊自动消失，不出现残留遮罩。
5. `typecheck` 通过；手动回归 expanded Modal 内生成/停止。

## 6) UI/UX

- **关键界面**：Portal 底栏 + 展开 Modal 均需 capsule（共用 `ImageGenerationPanel`）
- **关键状态**：generating / stopping / cancelled / success；stopping 时钮 disabled 防连点
- **键盘与焦点**：生成中 Esc 不关闭面板（与视频一致）或文档明确行为；停止钮可聚焦
- **本轮 UI 非目标**：不改节点 preview 上进度环；不改 Hermes job center

## 7) 风险与回退

- **主要风险**：cancel 后 agent 仍写 success；遮罩 z-index 盖住 Portal 菜单
- **触发条件**：停止无效；遮罩不消失；expanded 与 portal 行为不一致
- **回退动作**：移除 capsule，仅保留底栏 generating 图标
- **回退后保留**：cancel 前后 node data 截图

## 8) 完成定义（DoD）

- 验收 1～5 通过
- P0 包 iter-106～110 全部 DoD 完成后，更新 `iteration-106-110-igp-p0-roadmap.md` 状态为已交付
