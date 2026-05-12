# Slash Preset Commands Design

**Date:** 2026-05-12
**Feature:** `/` 斜杠预设命令 — 快速插入提示词模板

---

## 1. Concept & Vision

在任意 prompt 输入框中输入 `/`，弹出预设命令面板，按类别展示可复用的提示词模板，点击即插入光标位置。如果模板含 `{input}` 占位符，光标自动定位到该位置供用户填写。

用户也可创建自己的自定义预设，保存到本地或随项目携带。

---

## 2. Core Interaction Flow

```
用户输入 /
  → 光标位置检测屏幕空间
  → 空间足够 → 在光标下方显示预设浮层面板
  → 空间不够 → 在光标上方显示预设浮层面板
  → 面板显示：按类别分组 + 组内按使用频率排序
  → 用户键盘 ↑↓ 或鼠标选择预设
  → 按 Enter/Tab/点击插入 → 浮层关闭 → 文本插入光标位置
  → 如果模板含 {input} → 光标定位到 {input} 处，用户输入，{input} 消失

用户输入 @
  → 保持现有 MentionInput 下拉菜单（节点引用）
  → / 预设面板和 @ 节点引用互不干扰，独立触发
```

**退出机制：** 按 `Escape` 或点击浮层外部关闭面板，不插入任何内容。

---

## 3. Data Model

```typescript
interface SlashPreset {
  id: string;
  title: string;         // "人物三视图"
  desc: string;          // "一键生成人物多视图"
  icon: string;          // emoji: "🧍"
  template: string;     // "生成角色 {input} 的正视图、侧视图、后视图"
  category: Category;    // "人物参考" | "场景构图" | "脚本结构" | "信息提取" | "多宫格" | "通用"
  nodeTypes?: string[]; // 适用节点类型，可选
  isCustom: boolean;    // true = 用户自定义
  usageCount: number;    // 被使用次数，用于排序
  createdAt: number;    // 时间戳
}

type Category =
  | "人物参考"
  | "场景构图"
  | "脚本结构"
  | "信息提取"
  | "多宫格"
  | "通用";
```

**持久化：**

- **localStorage** — `canvasflow.slashPresets.v1`
- **项目文件** — `canvasflow.json` → `slashPresets: CustomSlashPreset[]`（`isCustom: true` 的条目）

---

## 4. Component Architecture

```
┌─────────────────────────────────────────────────┐
│ SlashPresetPanel.tsx                            │
│  - 独立浮层组件，由 MentionInput 的 / 触发唤起   │
│  - 接收 position, onSelect, onClose props       │
│  - 内部状态：searchQuery, selectedIndex          │
├─────────────────────────────────────────────────┤
│ SlashPresetDropdown.tsx                         │
│  - 预设列表渲染                                 │
│  - 按 category 分组，组内按 usageCount 排序       │
│  - 键盘导航支持                                  │
├─────────────────────────────────────────────────┤
│ useSlashPresets.ts                             │
│  - 加载内置 + 自定义 预设合集                    │
│  - 按 category 分类                              │
│  - usageCount 读写（每次插入后 +1）              │
│  - localStorage 持久化                           │
├─────────────────────────────────────────────────┤
│ LeftPresetDock.tsx                              │
│  - 左侧预设管理面板（增删改）                    │
│  - Tab 按 category 筛选                         │
│  - 内置预设只读，自定义可编辑/删除                │
└─────────────────────────────────────────────────┘
```

---

## 5. SlashPresetPanel 详细设计

### 5.1 定位逻辑

```typescript
// 计算浮层应该显示在光标上方还是下方
function computePanelPosition(
  cursorRect: DOMRect,
  panelHeight: number,
  viewportHeight: number
): "bottom" | "top" {
  const spaceBelow = viewportHeight - cursorRect.bottom;
  if (spaceBelow >= panelHeight + 8) return "bottom";
  return "top";
}
```

- 面板宽度固定 `320px`，高度最大 `360px`（超出部分滚动）
- 水平位置与光标对齐（left: cursorRect.left）

### 5.2 搜索过滤

- 面板顶部有搜索输入框，`/` 触发时自动聚焦
- 过滤匹配 `title`、`desc`、`template` 中包含查询字符串的预设
- 实时过滤，不需要回车确认

### 5.3 列表渲染

```tsx
// 按 category 分组，每组内按 usageCount 降序
const grouped = presets.reduce((acc, p) => {
  (acc[p.category] ??= []).push(p);
  return acc;
}, {} as Record<Category, SlashPreset[]>);

Object.entries(grouped).forEach(([category, items]) => (
  <div className="preset-group">
    <div className="preset-group-label">{category}</div>
    {items.map(preset => (
      <PresetItem preset={preset} />
    ))}
  </div>
));
```

### 5.4 键盘导航

| 按键 | 行为 |
|------|------|
| `↑` / `↓` | 在列表内上下移动选中项 |
| `Enter` / `Tab` | 选中并插入当前预设 |
| `Escape` | 关闭面板，不插入 |
| `/` | 关闭预设面板（在 `/` 触发后再次按 `/` 等于 Escape） |

---

## 6. LeftPresetDock 管理面板设计

```
┌─────────────────────────────────────┐
│  预设管理                   [最小化] │
│  ──────────────────────────────     │
│  [全部] [人物] [场景] [脚本] [通用] │  ← Tab 切换
│  ──────────────────────────────     │
│                                     │
│  🧍 人物三视图                       │
│     "生成角色 {input} 的三视图..."   │
│                           [删除]    │
│                                     │
│  📝 长篇精缩                         │
│     "将长篇内容精缩成短篇..."        │
│                           [删除]    │
│                                     │
│  ──────────────────────────────     │
│  + 新建预设                         │
│  ──────────────────────────────     │
│  [名称] ______________________     │
│  [分类] [人物参考 ▼]               │
│  [描述] ______________________     │
│  [模板] ______________________     │
│          [取消]  [保存预设]         │
└─────────────────────────────────────┘
```

- 面板从左侧滑入，与 `LeftAddDock` 并列（或作为其一个 Tab）
- 内置预设不可删除/编辑（灰显操作按钮）
- 自定义预设可删除，删除确认弹窗
- Tab 切换按 category 筛选，搜索框过滤

---

## 7. 内置预设初始集

**从 AI-CanvasPro 迁移（`promptPresets.js`）并补充：**

| Category | Preset | Template |
|----------|--------|----------|
| 人物参考 | 人物三视图 | 生成角色 **{input}** 的正视图、侧视图、后视图，包含站姿比例参考 |
| 人物参考 | 三视图+脸部 | 生成角色 **{input}** 的全身三视图 + 脸部特写，多角度展示 |
| 人物参考 | 人设解析图 | 生成角色 **{input}** 的人设解析图，包含正视图、侧视图、背视图、细节拆解 |
| 场景构图 | 场景参考图 | 生成场景参考图，包含顶视图、正交立面图、轴测图，*{input}* |
| 多宫格 | 四宫格 | 生成一张无缝的四宫格（2x2）连贯剧情分镜图，*{input}* |
| 多宫格 | 九宫格 | 生成一张无缝的九宫格（3x3）连贯剧情分镜图，*{input}* |
| 多宫格 | 十六宫格 | 生成一张无缝的十六宫格（4x4）连贯剧情分镜图，*{input}* |
| 脚本结构 | 叙事分镜脚本-v1 | 影视级叙事分镜脚本，包含以下要素：*{input}* |
| 脚本结构 | 秒级分镜脚本 | 生成秒级分镜脚本，每镜标注序号、时长、景别、画面描述、台词、音效，*{input}* |
| 信息提取 | 提取信息 | 从以下文本中提取人物、场景、道具、动作信息：*{input}* |
| 信息提取 | 长篇精缩 | 将以下长篇内容精缩成短篇，保留核心信息：*{input}* |
| 通用 | 通用续写 | 基于以下内容续写，要求风格一致：*{input}* |

---

## 8. MentionsInput 集成变更

**`MentionInput.tsx` 修改：**

- `handleChange` 中同时检测 `/` 和 `@` 触发
- 两者互斥：`/` 触发优先于 `@`（因为 `/` 是更明确的命令前缀）
- `/` 触发 → 向上抛出 `onSlashTrigger(cursorPosition)` 事件
- 父组件（LLMPanel / ScriptNode）监听事件，渲染 `<SlashPresetPanel>`
- 面板关闭后，通过 `onPresetInsert(preset, cursorPosition)` 回调注入文本

```typescript
// MentionInput 新增 props
interface MentionInputProps {
  // ... existing
  onSlashTrigger?: (position: { top: number; left: number }) => void;
  onPresetInsert?: (template: string) => void;
}
```

---

## 9. 文件结构

```
src/
├── components/
│   └── nodes/
│       ├── MentionInput.tsx        # 扩展 / 触发事件
│       └── SlashPresetPanel.tsx    # 新增：预设浮动面板
├── components/panels/
│   └── LeftPresetDock.tsx         # 新增：左侧预设管理面板
├── hooks/
│   └── useSlashPresets.ts         # 新增：预设数据 hook
├── lib/
│   └── slashPresets.ts             # 新增：预设数据 + 内置预设定义
└── store/
    └── projectStore.ts            # 修改：增加 slashPresets 字段
```

---

## 10. Out of Scope

- 多输入位 `{input1}` `{input2}` 多次跳转（本次只做单个 `{input}`）
- 预设模板的预览缩略图
- 预设的导入/导出功能
- 自定义预设的编辑（只做新增/删除）
- `/` 作为全局命令面板（非预设场景）

---

## 11. Manual Acceptance Steps

1. 在 LLMNode 输入框输入 `/`，确认预设面板在光标处弹出（下方空间足够时）
2. 在 LLMNode 输入框输入 `/`（光标靠近底部），确认预设面板切换到光标上方显示
3. 键盘 `↑↓` 导航预设列表，`Enter` 插入预设内容
4. 选择含 `{input}` 的预设，确认光标定位到 `{input}` 处
5. 删除 `{input}` 输入内容后按 `Enter`，确认文本正确插入
6. 打开左侧预设管理面板，新建自定义预设，确认保存后可在输入框 `/` 菜单中看到
7. 删除自定义预设，确认从 `/` 菜单中消失
8. 关闭面板后重新打开，确认自定义预设仍然存在（localStorage）
9. 预设使用次数多的排在前面
10. `Escape` 或点击外部关闭面板，不插入任何内容
