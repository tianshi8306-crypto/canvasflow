# 文本节点 Composer 底栏 UI 改版方案（仅视觉）

> **版本**：0.1（设计稿）  
> **日期**：2026-05-20  
> **范围**：**只改 UI / CSS / 布局**，不改交互逻辑、工作流、数据字段、Agent 调用  
> **视觉参考**：音频节点底栏（ATP）目标稿（用户截图：单输入区 + 快捷 Chip + 底栏模型/字数/发送）  
> **尺寸真源**：`src/lib/textNodeChrome.ts`（文本预览壳），**禁止**沿用图片/音频固定 `500px` 宽  
> **关联**：[`canvas-node-chrome-spec.md`](../node-ui-spec/canvas-node-chrome-spec.md)、[`text-node-states-spec.md`](./text-node-states-spec.md)

---

## 1. 改版目标

| 目标 | 说明 |
|------|------|
| 视觉统一 | 底栏 Composer 与参考图同一套「LibTV 极简面板」语言：无外框中框、无蓝灰 legacy 色 |
| 宽度对齐 | **底栏 Portal 宽度 = 预览壳实时宽度**（默认 300px），与节点本体上下对齐，不再 500px 溢出 |
| 信息分层 | 上：输入 + 展开；中：可选快捷 Chip；下：模型 + 元信息 + 生成钮（一行底栏） |
| 功能不变 | 仍用 `TextComposerPanel`、`MentionInput`、`TextProviderPicker`、钉住/展开/生成/取消；被动容器态显隐规则不变 |

---

## 2. 尺寸规范（完全套用文本节点外观）

数值来自 `textNodeChrome.ts` + `imageAspectSize`（16:9，长边基准 500 → 文本宽 ×0.6）。

### 2.1 预览壳（节点本体，不改比例）

| 项 | 默认 | 最小 | 最大（用户拖拽） | 说明 |
|----|------|------|----------------|------|
| 宽 `W_shell` | **300px** | **102px** | **840px** | `TEXT_NODE_CHROME_WIDTH` / `MIN` / `MAX_WIDTH` |
| 高 `H_shell` | **281px** | **54px** | **787px** | 与 16:9 画幅同高，空态/有正文相同 |
| 圆角 | 8px | — | — | `nodeChrome-shell` |
| 壳背景 | `#1f1f1f` | — | — | `--bg-node-preview` |
| 边框 | `rgba(255,255,255,0.12)` | 选中 `0.8` | — | 与图片节点一致 |

持久化：`params.chromeWidth` / `params.chromeHeight`；拖拽右下角手柄逻辑**不改**。

### 2.2 底栏 Composer Portal（本次改版核心）

| 项 | 规则 | 备注 |
|----|------|------|
| 宽 `W_panel` | **`W_panel = W_shell`（实时）** | `TextNodeBottomPortal` 传入 `panelWidth={frameSize.width}`；CSS 去掉 `.textNodeChrome--minimal { width: 500px }` 对底栏的硬编码 |
| 与壳水平对齐 | Portal `transform: translateX(-50%)`，中心与预览壳中心一致 | 已有 `useNodeGenerationChrome` |
| 与壳间距 | `gap = 12px`（`GEN_PANEL_CHROME_GAP`） | 与规范一致 |
| 外 padding | `8px 12px 8px`（保持现行底栏扁 padding） | `.nodeChrome--panel.textNodeChrome--minimal:has(.textGenPanel--chrome)` |
| 圆角 / 描边 / 阴影 | 同 `nodeChrome--panel`：`8px` / `rgba(255,255,255,0.12)` / `0 4px 24px rgba(0,0,0,0.4)` | 与参考图 ATP 外壳一致 |
| 面板背景 | `#1f1f1f`（`--bg-node-preview`） | 与壳同色系，非 `#121826` |

### 2.3 底栏内部高度（建议值，可微调 ±4px）

在 `W_panel = 300` 下紧凑排版（参考图比例缩放，**不**按 500px 稿直接照搬）：

| 区块 | 高度 | 内容 |
|------|------|------|
| A 输入顶栏 | 28px | 占位文案左 + 展开/钉住/收起图标右 |
| B 输入区 | **min 72px**，默认 **88px**，`flex:1` 上限 **120px** | `MentionInput`，无边框 |
| C 快捷 Chip 行 | 32px（有 Slash 能力时显示） | 胶囊按钮，横向滚动 |
| D 底栏控制行 | **36px**（`--tgp-control-h`） | 模型 pill + 字数 + 生成钮 |
| 行间距 `gap` | 6px | 区块之间 |
| **总高（默认）** | **约 154–170px** | 明显低于现行「带头标题 + 高输入」 |

空态仅 Composer（孤立文本、无连线）时：B 区可降至 min 64px，总高约 140px。

### 2.4 展开 Modal

| 项 | 规则 |
|----|------|
| 宽 | **`W_modal = W_shell`（打开时快照）**，最大不超过 `TEXT_NODE_CHROME_MAX_WIDTH` |
| 高 | `min(420px, calc(100vh - 48px))` |
| 内边距 | `12px 14px 14px`（与壳 padding 一致） |
| 结构 | 与底栏同一套四区布局，仅 B 区 `min-height: 160px`、`max-height: min(360px, calc(100vh - 220px))` |

### 2.5 顶栏（正文工具，非 Composer）

| 项 | 规则 |
|----|------|
| 宽 | 随 `W_shell`，`max-width: W_shell` |
| 高 | 40px（`nodeChrome--top`） |
| 显示 | 有正文或脚本上游时；与 [`text-node-states-spec`](./text-node-states-spec.md) 一致 |

---

## 3. 视觉参考对照（截图 → 文本 Composer）

```text
┌─ 外置标签「文本节点」────────────────────────────┐
│  [上传] 仅空态、选中时（文本无媒体时可省略或保留粘贴入口） │
┌─ 预览壳 W_shell × H_shell ────────────────────────┐
│  正文只读 / 空态 glyph / 双击编辑                  │
│  ⊕ 锚点                                            │
└───────────────────────────────────────────────────┘
        gap 12px
┌─ Composer Portal  W_panel = W_shell ──────────────┐
│ A │ 写下你想讲的故事…              [展开][钉][×] │  ← 无「模型对话」大标题
│ B │ ┌─────────────────────────────────────────┐ │
│   │ │ MentionInput（透明底，无内框）              │ │
│   │ └─────────────────────────────────────────┘ │
│ C │ [预设/格式 Chip…]  （可选，见 §4.2）          │
│ D │ [Provider▾ Minimax…]  …  12/200k  [↑生成]  │
└─────────────────────────────────────────────────┘
```

与参考图差异说明（** intentional**）：

| 参考图（音频） | 文本节点映射 |
|----------------|--------------|
| 「输入要合成的文本」 | 「写下你想讲的故事…」/ 空态同 `TEXT_EMPTY_PROMPT` |
| `<#> 停顿` `() 语气词` | **不新增 TTS 能力**；C 区改为 **Slash 预设胶囊**（现有 `SlashPresetPanel` 条目可视化，可选） |
| Minimax-speech 模型 | `TextProviderPicker` 触发器样式改为 **圆角 pill**（同参考图底栏左） |
| 字数 `0/50000` | `modelInput` 或 `prompt` 计数策略**不变**，仅右对齐样式 |
| 右侧闪电 `1` | **不增加**；保留生成钮上的进度/取消态 |
| 上传在节点上方 | 文本无媒体上传；保留顶栏「粘贴导入」 |

---

## 4. 组件与样式改造清单（仅 UI）

### 4.1 保留不动

- `TextNode.tsx` 状态机、`isPassiveTextContainer`、显隐条件  
- `TextComposerPanel` 内：`dispatchTextNodeComposerRun`、`TextProviderPicker`、生成/取消  
- `TextNodeBottomPortal` / `TextComposerPanelExpandedModal` Portal 机制  
- `TextPreviewToolbar` / 展开编辑 Modal 功能（展开编辑 Modal 已在 `TextNodeChrome.css` 对齐 token，仅微调间距）  
- 顶栏「从脚本同步」按钮  

### 4.2 `TextComposerPanel` 结构调整（DOM 重排，props 不变）

| 现行 | 目标 |
|------|------|
| `tgpChromeHead` + 标题「模型对话」 | **删除默认底栏标题行**；能力并入 A 区（占位 + 图标） |
| 输入区 + 外置 counter | B 区；counter 仍在输入区右下绝对定位 |
| `SlashPresetPanel` 浮层 | 保留；C 区增加 **可见 Chip 触发条**（点击仍打开原浮层，不新做业务） |
| `tgp-bottom-bar` 左模型 + 右发送 | D 区；模型触发器视觉改为 **pill**（高 36px，左侧图标+文案+chevron） |
| `imageGenPanel--minimal-inner` 类名 | 可保留作布局钩子；**不再**引入图片 IGP 头部/主体色 |

`layout` 枚举行为不变：`default` / `expanded` / `imageToPrompt` / `textToMusic` 仅换皮肤；`imageToPrompt` 在 C 区显示上游图缩略（宽 300 时缩略图 **48×48**）。

### 4.3 CSS 归属

| 文件 | 改动 |
|------|------|
| `TextNodeChrome.css` | 新增 `.tgp-v2-*` 或重构 `.textGenPanel--chrome` 四区布局；**底栏** `.textNodeChrome--minimal` 宽改为 `width: 100%` + 由 Portal 行内宽控制 |
| `TextNodeBottomPortal.tsx` | 传入 `panelWidth={frameSize.width}`（由 `TextNode` 计算传入） |
| `TextComposerPanelExpandedModal.tsx` | 卡片宽跟随 `W_shell`；类名 `tgp-expanded-shell` 保留 |
| `ImageGenerationPanelExpandedModal.css` | 文本展开规则已迁出；不再改 |
| `global.css` | 禁止回流 `.scriptGenComposer` 蓝灰边线 |

### 4.4 设计 Token（沿用，不新造色系）

与 [`canvas-node-chrome-spec.md`](../node-ui-spec/canvas-node-chrome-spec.md) §3 及现行 `--tgp-*` 一致：

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-node-preview` | `#1f1f1f` | Portal 底 |
| `--bg-button` | `#2b2b2b` | Chip、次要图标底 |
| `--border-button` | `#4d4d4d` | Chip 描边 |
| `--text-primary` | `#e0e0e0` | 输入 overlay 字色 |
| `--text-placeholder` | `#616161` | 占位 |
| `--tgp-control-h` | 36px（底栏）/ 40px（展开 Modal） | 底栏行高 |
| CTA 生成钮 | 36×36，白底 `#fff`，字 `#121212` | 与图片/音频一致 |

---

## 5. 显隐（与现规一致，不重写）

摘自 [`text-node-states-spec.md`](./text-node-states-spec.md) v1.1：

| 场景 | Composer 底栏 |
|------|----------------|
| 工作流容器（有连线传递/接收） | **隐藏** |
| 孤立空态 | 显示（紧凑高度） |
| 孤立有正文 | 默认隐藏；钉住后显示 |
| 展开 Modal | 底栏关闭，仅 Modal |

UI 改版**不得**破坏上述规则。

---

## 6. 实现顺序建议（供开发迭代）

1. **P0 宽度对齐**：Portal `panelWidth = frameSize.width`；去掉底栏 500px 硬编码  
2. **P1 四区布局 + 去标题行**：`TextComposerPanel` DOM/CSS  
3. **P2 底栏 D 区 pill 化**：`TextProviderPicker` 外壳样式（不改下拉逻辑）  
4. **P3 C 区 Slash Chip 条**（可选，纯视觉入口）  
5. **P4 展开 Modal 宽度跟随壳** + 回归截图对比  

每层仅 CSS/布局，单测不改业务逻辑。

---

## 7. 验收标准（手动）

1. 默认文本节点：壳 **300×281**，底栏 **300px 宽** 且中心对齐，无左右「板子比节点宽」感。  
2. 拖拽壳至约 400×375：底栏同步变宽，Composer 不撑破、不横向溢出。  
3. 配色与未展开壳一致（`#1f1f1f` / `#2b2b2b` / 白底生成钮），无 `#121826`、无蓝色描边 focus。  
4. 连线到视频/图片/脚本后：底栏仍不出现（容器态）。  
5. 展开 Modal 与底栏视觉同族，宽度与当时壳宽一致。  
6. `npm run typecheck` / 现有 vitest 无回归（无逻辑改动时）。  

---

## 8. 明确不做（Out of scope）

- 音频专属：停顿、语气词、TTS 音色、字数 50000 上限  
- 文本底栏宽改为 500px「与图片统一」  
- 工作流、反推、脚本同步逻辑变更  
- 壳内四入口、被动容器规则回退  
- 新增 Provider 或模型能力  

---

## 9. 附录：现行偏差（改版要修掉）

| 偏差 | 影响 |
|------|------|
| `.textNodeChrome--minimal { width: 500px }` | 底栏比壳宽 200px，与参考图「上下同宽」不符 |
| 默认 `GEN_PANEL_CHROME_WIDTH = 500` | Portal 定位按 500 算边界，与壳错位 |
| 独立「模型对话」标题行 | 比参考图多一行，底栏偏高、信息重复 |
| `imageGenPanel--minimal-inner` 历史类名 | 易继承图片 IGP 间距/色，造成「展开像换了一套 UI」 |

---

**下一步**：评审本方案后，按 §6 P0→P4 实施；若 C 区 Slash Chip 条需砍掉，可标为 P3 可选而不阻塞 P0–P2。
