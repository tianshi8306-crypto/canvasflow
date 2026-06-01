# 图片生成参数面板 LibTV P0 — 迭代路线图

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-29**  
> 状态：**🏁 IGP 收工**（P0 ✅ · P1/P2 UI 抛光 ⏭️ 不做）  
> 真源对照：[`gen-panel-design-system.md`](../design/gen-panel-design-system.md)（视频 `videoGenPanel--chrome`）  
> 问题来源：图片 IGP vs 视频 VGP 差距分析（2026-05-29）

## 收工声明（2026-05-29）

图片生成参数面板（`imageGenPanel--minimal` / `ImageGenerationPanel`）**在此结案**。后续仅修 bug 或 API/Provider 变更必要的接线，**不再**单开 IGP LibTV 抛光迭代（107/111/112 等）。

**已交付**：参考条 · `@` 媒体 pill · 状态轨 · 生成中胶囊 · `generate_image_asset` 全参数接线。  
**明确不做**：任务 Tab、底栏输出 pill 合并、CSS dead 规则大扫除（无功能收益）。

## 一句话

将图片节点生成参数面板（`imageGenPanel--minimal`）的 **P0 结构缺口** 拆为 5 轮独立迭代，按依赖顺序对齐视频面板已验证的 LibTV 闭环。

## P0 与迭代映射

| P0 | 问题摘要 | 迭代 | 前置 |
|----|----------|------|------|
| P0-1 | 无参考图条，仅只读 meta 方钮 | [iter-106](./iteration-106-igp-ref-thumb-strip.md) ✅ | — |
| P0-2 | 顶栏非创作模式 Tab，任务只读推断 | [iter-107](./iteration-107-igp-task-mode-tabs.md) ⏭️ 跳过 | iter-106 建议先合（Tab 与 ref 条联动） |
| P0-3 | `@` 无媒体 pill，与参考条未双向联动 | [iter-108](./iteration-108-igp-ref-mention-pills.md) ✅ | **依赖 iter-106** |
| P0-4 | 无统一状态轨（校验/失败/重试） | [iter-109](./iteration-109-igp-status-rail.md) ✅ | 可与 iter-110 并行 |
| P0-5 | 生成中无面板级胶囊/遮罩 | [iter-110](./iteration-110-igp-generating-capsule.md) ✅ | iter-109 建议先合（停止与状态一致） |

## 推荐执行顺序

```text
106 参考条 ──→ 108 @ pill 闭环
     │
     └──→ 107 任务 Tab（可与 108 交错，但 Tab 切换应驱动 ref 条显隐）

109 状态轨 ──→ 110 生成中胶囊
```

## 本轮路线非目标（P0 包整体不做）

- P1 底栏合并输出 pill、去掉 native `<select>` 张数（**⏭️ iter-111 跳过**：纯 UI，现有 select 已正确传 `count`）
- P1/P2 CSS 债务清理、dead 规则删除（**⏭️ 暂缓**：无功能收益，随大改版再清）
- 图片节点有成片后底栏常驻策略变更（产品决策，非 P0）
- Seedance 合规蓝勾（图片 Provider 若无等价能力则不引入假 UI）
- 新图片 Provider、Hermes 批量、底部 Dock

## P1 决策（2026-05-29）

与 iter-107 相同原则：**只做真功能，且与 CLI / Rust API 真对齐**；LibTV 纯 UI 抛光不单开迭代。

| 项 | 决策 | 说明 |
|----|------|------|
| iter-107 任务 Tab | ⏭️ 跳过 | `task` 由拓扑推断，`generate_image_asset` 收 `task` 参数 |
| iter-111 输出 pill 合并 | ⏭️ 跳过 | 底栏 `<select>` 张数 + 比例/分辨率 picker 已 wired 到 agent |
| iter-112 CSS 清理 | ⏭️ 暂缓 | dead 规则无运行时影响 |

### 真源对齐链（验收用）

```text
ImageGenerationPanel
  → detectImageTask / resolveImageGenerationContext（task + refs）
  → imageGenerationAgentRuntime.execute
  → invoke generate_image_asset {
       task, referenceImagePaths, resolution(size), count, imageModelId, prompt
     }
  → OpenAI /images/generations 或 dreamina_gen::generate_image_via_cli
```

| 参数 | UI 来源 | API |
|------|---------|-----|
| `task` | `detectImageTask(refs)` | body `task` / CLI |
| `referenceImagePaths` | 上游连线 + context | body `image`/`images` |
| `resolution` | `resolveImageApiSize(aspect, tier)` → `1024x1024` 等 | body `size` |
| `count` | 底栏 `<select>` `imageCount` | 循环 `1..=n` |
| `imageModelId` | `ImageModelPicker` | settings + vault key |

**P0 包（106/108/109/110）= 图片 IGP 最终交付边界（🏁 收工）。**

## 完成定义（P0 包 · 已达成）

- iter-106～110 各自 DoD 通过
- `docs/design/gen-panel-design-system.md` §5 图片行更新为「参考条 / @ pill / 状态轨」已落地项
- `docs/node-ui-spec/canvas-node-chrome-spec.md` 补充 IGP 与 VGP 对齐 §（若行为变更）
