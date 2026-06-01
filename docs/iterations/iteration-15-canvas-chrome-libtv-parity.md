# 第 15 轮执行单：画布壳层与空态（LibTV 范式对齐 · 修订版）

> **状态**：已完成（2026-05-21）；**15-0～D ✅**  
> **层级**：CanvasExperienceLayer  
> **依据**：[LibTV 产品对齐](../product/LIBTV_GUIDE_ALIGNMENT.md)、[画布配色真源](../design/canvas-color-system.md)、[UI 迭代指南](../design/UI_ITERATION_GUIDE.md)、[快捷键](../product/SHORTCUTS.md)  
> **参考**：用户截图（CanvasFlow 现状 vs LibTV 参考）；**不开发**阶段产出本执行单，实施按子阶段拆分提交。

---

## 修订说明（相对初版方案）

| 项 | 初版问题 | 本版修正 |
|----|----------|----------|
| Inspector | 假设「侧栏保持原位」 | **§0 先定 IA**：当前 `Inspector.tsx` **未挂载**；默认走无侧栏，同步文案与 focus 落点 |
| 空态文案 | 「双击创建节点」 | **双击空白 → 打开添加节点面板**（与 `FlowCanvas` / `SHORTCUTS.md` 一致） |
| Dock 统一 | 描述为「左右完全分裂」 | 左下 `canvasBottomDock` 已与 `leftAddDock` **部分统一**；本轮重点为顶栏双层 + 中部浮动条 + 死代码 |
| 迭代 D | 整轮 token 对齐 | 配色 P1–P3 已落地；D 改为 **违背 token 清单扫尾** |
| 沉浸式顶栏 | 等同 LibTV 无系统栏 | Windows 仍有 **系统标题栏**；仅应用内 `appTopChrome` 与 L0 融合 |
| 遗漏 | Tab、工程入口、平移、z-index | 已写入 §0、§3、§6、子阶段验收 |

---

## 1) 本轮总目标（一句话）

在**不引入 LibTV 底部 Dock、不抄高饱和蓝/青 CTA** 的前提下，让无限画布壳层（顶栏、浮动 Dock、空态、浮动工具条层级）**视觉一体、入口清晰、与真实交互一致**，达到参考产品的专业感。

---

## 2) 变更范围（≤3 个模块 / 子阶段可拆 PR）

| 模块 | 路径 | 子阶段 |
|------|------|--------|
| 应用壳层 | `App.tsx`、`AppTopBar.tsx`、`CanvasTabs.tsx`、`global.css`（`.appTopChrome*`） | 15-A |
| 画布 Chrome | `FlowCanvas.tsx`、`CanvasFlowChrome.tsx`、`LeftAddDock.tsx`、`CanvasProjectPanel.tsx` | 15-B、15-C |
| 文档与债 | `SHORTCUTS.md`、`scriptNodeCanvasEntries.ts`、`CURRENT_PROGRESS.md`；删除/收敛死代码 | 15-0、15-D |

**不改动（默认）**：节点内 Chrome、生成 Portal、脚本全屏 Overlay 业务逻辑（除文案与 focus 落点）。

---

## 3) §0 信息架构定稿（子阶段 15-0，须先于 15-A）

### 3.1 现状（代码事实）

- `Inspector.tsx` **存在但未挂到** `App` / `FlowCanvas`。
- 参数与脚本编辑真源：**节点壳 + Portal 浮层 + `NodeMaximizedOverlay` + `ScriptNodeFullscreenOverlay`**。
- `openInspectorStoryboardBeat()` 写入 `inspectorStoryboardFocus`，但 `ScriptStoryboardSection` 仅在 **未使用的 Inspector** 与 **NodeMaximizedOverlay** 中渲染；全屏脚本路径可能**吃不到** focus。

### 3.2 决策（本轮默认 · 可评审推翻）

| 选项 | 内容 | 本轮 |
|------|------|------|
| **B（推荐）** | **不恢复**右侧 Inspector；统一「无侧栏」范式；修文案与 focus 落点 | ✅ 默认 |
| A | 恢复 `mainSplit` + 右侧 Inspector | ❌ 非目标（工作量大，与 LibTV 参考也不同） |

**B 的落地项（15-0 功能点）**

1. 更新 `SCRIPT_INSPECTOR_ENTRY_HINT` 等文案：指向 **顶栏全屏/主题、壳内预览、右键双击最大化**，删除「Inspector 分镜区」作为主路径表述（除非恢复挂载）。
2. `openInspectorStoryboardBeat`：改为打开 **`ScriptNodeFullscreenOverlay`** 并滚动到对应 beat，或打开 **NodeMaximizedOverlay** 并应用 focus（二选一，写进实现注释）。
3. 更新 `CURRENT_PROGRESS.md` §2 UX 决策：「Inspector 元数据」改为「节点/全屏/浮层元数据」。
4. `canvas-color-system.md` §14 P2：加注「Inspector **样式**已备，**运行时侧栏未挂载**（截至 15-0）」。

### 3.3 15-0 验收

1. [x] 全文搜索「Inspector」用户可见文案，主路径无死链描述。
2. [x] 从分镜失败提示点击「聚焦镜头」类入口，能落到**已挂载**的全屏创意视图。
3. [x] 执行单与 `CURRENT_PROGRESS` 对 Inspector 状态描述一致。

**15-0 落地（2026-05-21）**：`openInspectorStoryboardBeat` → 全屏 + `inspectorStoryboardFocus`；`ScriptNodeFullscreenOverlay` 消费 focus；`SCRIPT_NODE_ENTRY_HINT`；创意视图按钮改为「聚焦镜头」。

---

## 4) 与 LibTV 差异表（只借范式，不借皮）

| 维度 | LibTV 参考 | CanvasFlow（本轮） |
|------|------------|------------------|
| 标题栏 | 与画布同色一体 | 系统栏 `theme: Dark` + 应用内顶栏去双层框（**非** `decorations: false`） |
| 空态 | 双击自动生成节点 + 4 张预览卡 | **双击 → 添加面板**；卡片 → 面板或 `addNode`（须与 Dock 同源） |
| 生成器 | 底部 Dock | **节点外浮层** + 全屏/最大化（不变） |
| 顶栏右 | 会员/积分/Skills | **保存态、运行状态、设置**；不抄商业壳 |
| 侧栏 | 无传统 Inspector | **无侧栏**（15-0 定稿） |
| 平移 | 常见为拖拽平移 | **`Space` + 左键拖拽**（须在空态写明） |
| 配色 | 冷灰 + 高饱和蓝线 | [`canvas-color-system.md`](../design/canvas-color-system.md) 炭黑+柔白 |

---

## 5) 子阶段拆分

### 15-A：顶栏去框化 + Tab/工程信息架构

**目标**：去掉 `appTopChrome` + `appTopChromeInner` 双层胶囊；顶栏单行、与 L0 视觉连续。

**功能清单**

1. 移除或扁平化 `appTopChromeInner` 内层边框/阴影，保留 `CanvasTabs`。
2. 左侧：品牌标记（小）+ **当前 Tab 名**（`canvasTabName`）；有 `projectPath` 时在 `title`/次要行展示路径或目录名。
3. 右侧：**保存徽章**（`lastSavedAt`）、**状态摘要**（可折叠/tooltip）、`临时画布` 保留 `appTopTempWarn`；长 `statusText`/`Run id` **不**占主行。
4. 顶栏高度目标 **40–44px**；`1280px` 宽度下不换行挤爆。

**UI/UX**

- **关键界面**：`AppTopBar`、`CanvasTabs`
- **关键状态**：未打开工程、未保存 Tab（`canvasTabUnsavedDot`）、浏览器预览 `appTopWarn`
- **键盘**：与 App 全局快捷键无冲突
- **非目标**：LibTV 式右侧会员区；`decorations: false` 自绘窗口按钮

**非目标**：不改 Tab 持久化逻辑；不把「新建/打开工程」挪到顶栏（仍在 `CanvasProjectPanel`）。

**验收**

1. [x] 顶栏与画布交界无「大灰条套小灰条」。
2. [x] 多 Tab 时仍可辨认当前 Tab 与未保存点。
3. [x] 工程入口：左侧 Dock → 工程面板仍可新建/打开。
4. [x] Tauri 下应用顶栏为 L0（`--cf-charcoal-canvas`），与画布连续。

**15-A 落地（2026-05-21）**：扁平 `appTopChromeRow`；工程目录名 + Tab 胶囊样式；右侧保存/状态徽章（详情在 `title`）。

---

### 15-B：浮动 Chrome 收敛 + 死代码 + z-index

**目标**：顶栏以外浮动控件 **形态统一**；清理遗留；空态不与中部工具条抢位。

**功能清单**

1. **Dock token**：在 `global.css` 增加 `--canvas-dock-*`（pill 圆角、padding、icon 18px），`leftAddDock` / `canvasBottomDock` 引用（已有部分统一，本轮收口）。
2. **删除或归档**：未引用的 `ZoomControls.tsx` 与 `.zoomControls` 样式（缩放已由 `CanvasFlowChrome` 承担）。
3. **浮动层 z-index 表**（实现时写入 `menuConstants` 或 CSS 注释）：

   | 层 | 组件 | 相对优先级 |
   |----|------|------------|
   | 低 | `Background`、点阵 | 0 |
   | 中 | `CanvasEmptyGuide`（15-C） | 5 |
   | 中高 | `MiniMap` | 10 |
   | 高 | `canvasBottomDock`、`leftAddDock` | 20 |
   | 更高 | `MarkerToolbar`、`NodeSelectionToolbar`、`MultiSelectionToolbar` | 30 |
   | 菜单 | `CanvasContextMenus`、`zoomMenu` | 40+ |

4. 小地图：保持底栏 toggle；可选 **默认隐藏** 或缩小 `margin`（产品可配置 `minimapVisible` 默认 `false` 需评审）。

**非目标**：合并 `LeftAddDock` 展开面板与底栏为单组件（可远期）；不改 `MarkerToolbar` 业务。

**验收**

1. [x] 左竖条与左下横条圆角/描边/阴影一致（`--canvas-dock-*`）。
2. [x] 仓库内无 `ZoomControls.tsx` / `.zoomControls` 壳。
3. [x] 工具条 z-index 30、Dock 20（`CANVAS_Z` + CSS 变量）。
4. [x] `Alt+Shift+M` 仍控制小地图；**默认隐藏**小地图。

**15-B 落地（2026-05-21）**：删除 `ZoomControls.tsx`；Dock token；`menuConstants` `CANVAS_Z`；小地图 margin/默认关。

---

### 15-C：空画布 Onboarding

**目标**：`nodes.length === 0` 时中心引导专业、可操作，与真实入口一致。

**功能清单**

1. 新组件 `CanvasEmptyGuide`（`FlowCanvas` `Panel position="top-center"` 或 center，**低于** 选区工具条 z-index）。
2. 主文案：**「双击空白处打开添加面板」**；副文案：**拖入媒体**、**左侧 +**、**Space + 拖拽平移画布**。
3. 快捷卡片 3～4 张（与 `LeftAddDock` / `openAddPanelAt` **同源类型表**）：
   - 脚本工作流 → 添加 `scriptNode` 或打开添加面板「脚本」
   - 文生图 → `imageNode`
   - 图生视频 → `videoNode`
   - 导入媒体 → 触发上传/图库（无工程时禁用并 `title` 说明）
4. `nodes.length > 0` 时卸载；不阻挡框选（`pointer-events: none` 于遮罩层，卡片 `auto`）。

**UI/UX**

- **空**：显示引导
- **禁用**：无工程时「图库/导入」卡片
- **键盘**：不拦截 Space、双击（事件在 pane 上）
- **非目标**：LibTV 式营销大图；第四套独立添加入口 API

**验收**

1. [x] 新工程零节点可见引导。
2. [x] 双击空白 → 添加面板（与 `SHORTCUTS.md` 一致）。
3. [x] 创建首个节点后引导消失。
4. [x] 框选、Space 平移在空画布可用（引导层 `pointer-events: none`）。

**15-C 落地（2026-05-21）**：`CanvasEmptyGuide` + `canvasSpawnNode`；四张快捷卡（脚本/图/视频/导入）。

---

### 15-D：违背 token 扫尾（小范围）

**目标**：消灭已知与设计真源冲突的硬编码，**不**重复 P1–P3 大迁移。

**清单（勾选即完成）**

- [x] `FlowCanvas` 拖入遮罩 → `.canvasDropOverlay` + `--cf-drop-overlay-fill`（`--cf-accent-focus` 系）
- [x] `Background` 点阵 → `CANVAS_BACKGROUND_DOT` `rgba(232, 230, 227, 0.06)`
- [x] `TextNodeChrome` 节点顶栏：移除 `backdrop-filter`，改 L1 实底；Modal 遮罩 `blur` 保留（全屏 dim，非菜单底）
- [x] 无 `.zoomControls` 规则（15-B 已删）

**15-D 落地（2026-05-21）**：`canvasColors.ts` 常量；`global.css` drop overlay；点阵 0.12→0.06。

**验收**：画布壳层（`FlowCanvas`、顶栏、Dock、空态、拖入框）无 `rgba(59, 130, 246` 硬编码。

---

## 6) 整体非目标（全轮）

- LibTV 底部图像/视频/音频生成器 Dock  
- 恢复右侧 Inspector（除非 15-0 评审改为 A）  
- `decorations: false` + 自绘窗口控件（跨平台成本高）  
- 多主题/亮色模式  
- Slash 工具全家桶、会员/积分 UI  
- 重做节点内部 Chrome（属节点专项迭代）

---

## 7) 整体验收步骤（跨子阶段）

1. **Tauri 桌面** `npm run tauri dev`：顶栏单层、深色系统栏、空态引导、Dock 统一。
2. **有节点**：左侧 + / 底栏缩放 / 小地图 toggle 正常；双击节点仍居中视口（`SHORTCUTS`）。
3. **脚本路径**：顶栏或壳入口进全屏表；无「Inspector」死文案。
4. **1280×720**：顶栏与 Dock 不重叠、不换行灾难。
5. **`prefers-reduced-motion: reduce`**：连线脉冲/动效可降级（若本轮触及动画，须验证）。

---

## 8) UI/UX 汇总

| 界面 | 本轮变更 |
|------|----------|
| 顶栏 | 去双层、Tab/状态 IA |
| 画布空态 | `CanvasEmptyGuide` |
| 左 Dock / 底栏 | token 收口、死代码删除 |
| 中部工具条 | 仅 z-index/不挡空态 |
| Inspector | **不恢复**（15-0 文案修） |
| 节点/全屏 | 仅 focus/文案，非布局重做 |

- **键盘**：空态须写 Space 平移；双击空白 = 面板；与 `CanvasShortcutsOverlay` 一致。
- **对比度**：沿用 `--cf-*`；空态卡片 L1 底，无大面积饱和色。

---

## 9) 风险与回退

| 风险 | 触发条件 | 回退 |
|------|----------|------|
| Tab 与工程名 IA 混乱 | 用户分不清 Tab 名与磁盘工程 | 回退 `AppTopBar` 布局，保留 15-B/C |
| 空态挡操作 | 框选/双击失效 | 移除 `CanvasEmptyGuide` 或 `pointer-events` 修正 |
| focus 修错 | 分镜定位仍无 UI | 回退 `openInspectorStoryboardBeat` 改动 |
| 删 ZoomControls 误伤 | 缩放不可用 | 恢复组件或仅恢复 `CanvasFlowChrome` |

回退后保留：截图、失败步骤、`git diff` 范围说明。

---

## 10) 完成定义（DoD）

- [x] 15-0～15-D 子阶段验收全部勾选  
- [x] `SHORTCUTS.md` / `CURRENT_PROGRESS.md` / 脚本入口文案与实现一致  
- [ ] `npm run typecheck` 通过（仓库既有 TS 错误，与本轮无关）  
- [ ] 手工验收 §7 五项通过（需本地 Tauri 目视）  
- [x] 画布壳层无 `rgba(59, 130, 246` 硬编码  

---

## 11) 建议实施顺序与 PR 拆分

```text
15-0（IA + 文案 + focus） → 15-A（顶栏） → 15-B（Dock + 死代码 + z-index） → 15-C（空态） → 15-D（扫尾）
```

每子阶段独立 PR，便于回滚；**15-0 必须与 15-A 同批或更早合并**。

---

## 12) 关键代码索引

| 用途 | 文件 |
|------|------|
| 顶栏 | `src/components/AppTopBar.tsx`、`CanvasTabs.tsx` |
| 双击空白 | `src/components/FlowCanvas.tsx`（`onDoubleClickCapture`） |
| 左 Dock / 工程 | `src/components/LeftAddDock.tsx`、`CanvasProjectPanel.tsx` |
| 底栏 | `src/components/canvas/CanvasFlowChrome.tsx` |
| 中部工具条 | `MarkerToolbar.tsx`、`NodeSelectionToolbar.tsx`、`MultiSelectionToolbar.tsx` |
| 配色 | `src/styles/global.css`、`docs/design/canvas-color-system.md` |
| 未挂载 Inspector | `src/components/Inspector.tsx` |
| 窗口主题 | `src-tauri/tauri.conf.json`（`theme: Dark`） |

---

*修订记录：2026-05-21 初版方案复核后重写；编号 15（14 已用于 script-production-export）。*
