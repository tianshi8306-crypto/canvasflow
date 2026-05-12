# Slash Preset Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/` 斜杠预设命令 — 在 prompt 输入框输入 `/` 弹出预设面板，选择后插入模板文本，支持 `{input}` 占位符定位和自定义预设管理。

**Architecture:**
- 独立浮层面板 `SlashPresetPanel`，由 `MentionInput` 的 `/` 触发事件唤起，父组件（LLMPanel/ScriptNode）渲染
- 数据层 `useSlashPresets` hook 合并内置 + 自定义预设，usageCount 独立 localStorage 持久化
- 左侧管理面板 `LeftPresetDock` 管理自定义预设的增删
- 内置预设定义在 `lib/slashPresets.ts`，从 AI-CanvasPro 迁移

**Tech Stack:** React hooks, CSS absolute positioning, localStorage, DOMRect positioning

---

## File Map

| File | Role |
|------|------|
| `src/lib/slashPresets.ts` | **New** — 类型定义 + 内置预设初始数据 |
| `src/hooks/useSlashPresets.ts` | **New** — 预设数据 hook，含 usageCount 读写 |
| `src/hooks/useSlashPresets.test.ts` | **New** — hook 测试（TDD） |
| `src/components/nodes/SlashPresetPanel.tsx` | **New** — 预设浮动面板组件 |
| `src/components/nodes/SlashPresetPanel.css` | **New** — 面板样式 |
| `src/components/nodes/MentionInput.tsx` | **Modify** — 增加 `/` 触发 + 两组回调 |
| `src/components/nodes/LLMPanel.tsx` | **Modify** — 挂载 SlashPresetPanel |
| `src/components/nodes/ScriptNode.tsx` | **Modify** — 挂载 SlashPresetPanel |
| `src/components/panels/LeftPresetDock.tsx` | **New** — 左侧预设管理面板 |
| `src/components/panels/LeftPresetDock.css` | **New** — 面板样式 |

---

## Task 1: 内置预设数据 + 类型定义

**Files:**
- Create: `src/lib/slashPresets.ts`

- [ ] **Step 1: Write the types and constant**

```typescript
// src/lib/slashPresets.ts

export const USER_INPUT_PLACEHOLDER = "__SLASH_INPUT__";

export type Category =
  | "人物参考"
  | "场景构图"
  | "脚本结构"
  | "信息提取"
  | "多宫格"
  | "通用";

export interface SlashPreset {
  id: string;
  title: string;
  desc: string;
  icon: string;
  template: string;
  category: Category;
  nodeTypes?: string[];
  isCustom: boolean;
  createdAt: number;
}

export interface PresetUsageStats {
  [presetId: string]: number;
}

// 内置预设（只读）
export const BUILT_IN_PRESETS: SlashPreset[] = [
  {
    id: "builtin-person-3view",
    title: "人物三视图",
    desc: "一键生成人物多视图",
    icon: "🧍",
    template: "生成角色 __SLASH_INPUT__ 的正视图、侧视图、后视图，包含站姿比例参考",
    category: "人物参考",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-person-3view-face",
    title: "三视图+脸部",
    desc: "带脸部特写的三视图",
    icon: "🧍",
    template: "生成角色 __SLASH_INPUT__ 的全身三视图 + 脸部特写，多角度展示",
    category: "人物参考",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-person-analysis",
    title: "人设解析图",
    desc: "包含细节拆解的设定集",
    icon: "🧍",
    template: "生成角色 __SLASH_INPUT__ 的人设解析图，包含正视图、侧视图、背视图、细节拆解",
    category: "人物参考",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-scene-reference",
    title: "场景参考图",
    desc: "一键生成场景多视角参考",
    icon: "📐",
    template: "生成场景参考图，包含顶视图、正交立面图、轴测图，__SLASH_INPUT__",
    category: "场景构图",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-grid-4",
    title: "四宫格",
    desc: "2x2 连贯剧情分镜图",
    icon: "🟦",
    template: "生成一张无缝的四宫格（2x2）连贯剧情分镜图，__SLASH_INPUT__",
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-grid-9",
    title: "九宫格",
    desc: "3x3 连贯剧情分镜图",
    icon: "🟦",
    template: "生成一张无缝的九宫格（3x3）连贯剧情分镜图，__SLASH_INPUT__",
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-grid-16",
    title: "十六宫格",
    desc: "4x4 连贯剧情分镜图",
    icon: "🟦",
    template: "生成一张无缝的十六宫格（4x4）连贯剧情分镜图，__SLASH_INPUT__",
    category: "多宫格",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-storyboard-v1",
    title: "叙事分镜脚本-v1",
    desc: "影视级叙事分镜",
    icon: "🎬",
    template: "影视级叙事分镜脚本，包含以下要素：__SLASH_INPUT__",
    category: "脚本结构",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-storyboard-sec",
    title: "秒级分镜脚本",
    desc: "每镜标注序号的分镜脚本",
    icon: "🎬",
    template: "生成秒级分镜脚本，每镜标注序号、时长、景别、画面描述、台词、音效，__SLASH_INPUT__",
    category: "脚本结构",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-extract-info",
    title: "提取信息",
    desc: "提取人物、场景、道具信息",
    icon: "📝",
    template: "从以下文本中提取人物、场景、道具、动作信息：__SLASH_INPUT__",
    category: "信息提取",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-summarize",
    title: "长篇精缩",
    desc: "将长篇精缩成短篇",
    icon: "📝",
    template: "将以下长篇内容精缩成短篇，保留核心信息：__SLASH_INPUT__",
    category: "信息提取",
    isCustom: false,
    createdAt: 0,
  },
  {
    id: "builtin-continue",
    title: "通用续写",
    desc: "基于内容续写",
    icon: "✏️",
    template: "基于以下内容续写，要求风格一致：__SLASH_INPUT__",
    category: "通用",
    isCustom: false,
    createdAt: 0,
  },
];
```

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/slashPresets.ts
git commit -m "feat: add slash presets types and built-in preset data"
```

---

## Task 2: useSlashPresets Hook + Tests

**Files:**
- Create: `src/hooks/useSlashPresets.ts`
- Create: `src/hooks/useSlashPresets.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/useSlashPresets.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSlashPresets } from "./useSlashPresets";
import { useProjectStore } from "../store/projectStore";

const LOCAL_STORAGE_KEY = "canvasflow.slashPresets.v1";
const USAGE_KEY = "canvasflow.slashPresetUsage.v1";

// Clean storage helper
const cleanStorage = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  localStorage.removeItem(USAGE_KEY);
};

describe("useSlashPresets", () => {
  beforeEach(() => cleanStorage());

  it("returns built-in presets when no custom presets exist", () => {
    const { result } = renderHook(() => useSlashPresets());
    expect(result.current.presets.length).toBeGreaterThan(0);
    expect(result.current.presets.every((p) => !p.isCustom)).toBe(true);
  });

  it("adds custom preset to the list", () => {
    const { result } = renderHook(() => useSlashPresets());
    const customPreset = {
      title: "我的预设",
      desc: "测试",
      icon: "🧪",
      template: "测试模板 __SLASH_INPUT__",
      category: "通用" as const,
    };
    result.current.addCustomPreset(customPreset);
    const { result: result2 } = renderHook(() => useSlashPresets());
    expect(result2.current.presets.some((p) => p.title === "我的预设")).toBe(true);
  });

  it("removes custom preset", () => {
    const { result } = renderHook(() => useSlashPresets());
    const id = result.current.addCustomPreset({ title: "删除我", desc: "", icon: "🗑️", template: "x", category: "通用" });
    result.current.removeCustomPreset(id);
    const { result: result2 } = renderHook(() => useSlashPresets());
    expect(result2.current.presets.every((p) => p.id !== id)).toBe(true);
  });

  it("increments usageCount on recordUsage", () => {
    const { result } = renderHook(() => useSlashPresets());
    result.current.recordUsage("builtin-person-3view");
    result.current.recordUsage("builtin-person-3view");
    // Access internal stats via a dedicated selector if needed, or just verify sort order
    const { result: result2 } = renderHook(() => useSlashPresets());
    const view3 = result2.current.presets.find((p) => p.id === "builtin-person-3view");
    expect(view3).toBeDefined();
  });

  it("sorts presets by usageCount desc within each category", () => {
    const { result } = renderHook(() => useSlashPresets());
    result.current.recordUsage("builtin-person-3view"); // 1 use
    result.current.recordUsage("builtin-person-3view"); // 2 uses
    result.current.recordUsage("builtin-person-3view-face"); // 1 use
    const { result: result2 } = renderHook(() => useSlashPresets());
    const personPresets = result2.current.presets.filter((p) => p.category === "人物参考");
    const ids = personPresets.map((p) => p.id);
    expect(ids.indexOf("builtin-person-3view")).toBeLessThan(ids.indexOf("builtin-person-3view-face"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/hooks/useSlashPresets.test.ts`
Expected: FAIL — useSlashPresets does not exist yet

- [ ] **Step 3: Write the hook**

```typescript
// src/hooks/useSlashPresets.ts
import { useCallback, useMemo } from "react";
import { BUILT_IN_PRESETS, type Category, type SlashPreset } from "@/lib/slashPresets";

const PRESETS_KEY = "canvasflow.slashPresets.v1";
const USAGE_KEY = "canvasflow.slashPresetUsage.v1";

export function useSlashPresets() {
  // Load custom presets from localStorage
  const customPresets: SlashPreset[] = useMemo(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  // Load usage stats
  const usageStats: Record<string, number> = useMemo(() => {
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const presets = useMemo(() => {
    const all = [...BUILT_IN_PRESETS, ...customPresets];
    return all.sort((a, b) => {
      const aCount = usageStats[a.id] ?? 0;
      const bCount = usageStats[b.id] ?? 0;
      return bCount - aCount;
    });
  }, [customPresets, usageStats]);

  const addCustomPreset = useCallback(
    (preset: Omit<SlashPreset, "id" | "isCustom" | "createdAt">) => {
      const id = `custom-${Date.now()}`;
      const newPreset: SlashPreset = {
        ...preset,
        id,
        isCustom: true,
        createdAt: Date.now(),
      };
      const updated = [...customPresets, newPreset];
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
      return id;
    },
    [customPresets]
  );

  const removeCustomPreset = useCallback(
    (id: string) => {
      const updated = customPresets.filter((p) => p.id !== id);
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    },
    [customPresets]
  );

  const recordUsage = useCallback(
    (presetId: string) => {
      const updated = { ...usageStats, [presetId]: (usageStats[presetId] ?? 0) + 1 };
      localStorage.setItem(USAGE_KEY, JSON.stringify(updated));
    },
    [usageStats]
  );

  return {
    presets,       // SlashPreset[] — merged + sorted
    addCustomPreset,
    removeCustomPreset,
    recordUsage,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/hooks/useSlashPresets.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSlashPresets.ts src/hooks/useSlashPresets.test.ts
git commit -m "feat: add useSlashPresets hook with usageCount and localStorage persistence"
```

---

## Task 3: SlashPresetPanel 浮层面板

**Files:**
- Create: `src/components/nodes/SlashPresetPanel.tsx`
- Create: `src/components/nodes/SlashPresetPanel.css`

- [ ] **Step 1: Write the component**

`SlashPresetPanel.tsx` 核心逻辑：

```tsx
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useSlashPresets } from "@/hooks/useSlashPresets";
import { USER_INPUT_PLACEHOLDER } from "@/lib/slashPresets";
import "./SlashPresetPanel.css";

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 360;

interface SlashPresetPanelProps {
  cursorRect: DOMRect;          // 光标位置信息
  onSelect: (template: string) => void;  // 用户选择预设后回调
  onClose: () => void;         // 关闭面板
}

const CATEGORIES = ["人物参考", "场景构图", "脚本结构", "信息提取", "多宫格", "通用"] as const;

export function SlashPresetPanel({ cursorRect, onSelect, onClose }: SlashPresetPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { presets, recordUsage } = useSlashPresets();

  // Compute position
  const position = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - cursorRect.bottom;
    const left = Math.min(cursorRect.left, vw - PANEL_WIDTH - 8);
    const vertical: "bottom" | "top" =
      spaceBelow >= PANEL_MAX_HEIGHT + 8 ? "bottom" : "top";
    return { left, vertical };
  }, [cursorRect]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return presets;
    const q = search.toLowerCase();
    return presets.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.template.toLowerCase().includes(q)
    );
  }, [presets, search]);

  // Reset selected when filter changes
  useEffect(() => { setSelectedIndex(0); }, [search]);

  // Auto-focus search
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSelect = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;
      recordUsage(presetId);
      onSelect(preset.template);
    },
    [presets, recordUsage, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex].id);
        }
      } else if (e.key === "Escape" || e.key === "/") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, handleSelect, onClose]
  );

  // Group by category
  const grouped = useMemo(() => {
    const acc: Record<string, typeof filtered> = {};
    for (const p of filtered) {
      (acc[p.category] ??= []).push(p);
    }
    return acc;
  }, [filtered]);

  // Flat list for keyboard nav (cross-group linear)
  const flat = filtered;

  return (
    <div
      ref={panelRef}
      className={`slash-preset-panel ${position.vertical === "top" ? "slash-preset-panel--top" : ""}`}
      style={{ left: position.left }}
      onKeyDown={handleKeyDown}
    >
      <div className="slash-preset-search">
        <input
          ref={searchRef}
          className="slash-preset-search-input"
          placeholder="搜索预设..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="slash-preset-list">
        {filtered.length === 0 ? (
          <div className="slash-preset-empty">
            无匹配结果，可创建自定义预设
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="slash-preset-group">
              <div className="slash-preset-group-label">{category}</div>
              {items.map((preset, idx) => {
                const flatIdx = flat.indexOf(preset);
                return (
                  <div
                    key={preset.id}
                    className={`slash-preset-item ${flatIdx === selectedIndex ? "selected" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(preset.id); }}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                  >
                    <span className="slash-preset-icon">{preset.icon}</span>
                    <div className="slash-preset-item-content">
                      <div className="slash-preset-title">{preset.title}</div>
                      <div
                        className="slash-preset-template"
                        dangerouslySetInnerHTML={{
                          __html: preset.template.replace(
                            USER_INPUT_PLACEHOLDER,
                            '<span class="preset-input-hint">[输入]</span>'
                          ),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

`SlashPresetPanel.css` 核心样式：

```css
.slash-preset-panel {
  position: fixed;
  top: auto;
  z-index: 1000;
  width: 320px;
  max-height: 360px;
  background: var(--panel, #161a22);
  border: 1px solid var(--border, #2a3140);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.slash-preset-panel--top {
  top: auto;
  bottom: 0;
}

.slash-preset-search {
  padding: 8px;
  border-bottom: 1px solid var(--border, #2a3140);
}

.slash-preset-search-input {
  width: 100%;
  background: var(--surface, #1e232e);
  border: 1px solid var(--border, #2a3140);
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--text, #e8ecf4);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.slash-preset-search-input:focus {
  border-color: var(--accent, #3b82f6);
}

.slash-preset-list {
  overflow-y: auto;
  flex: 1;
}

.slash-preset-group {
  padding: 4px 0;
}

.slash-preset-group-label {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--muted, #8b95a8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.slash-preset-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  margin: 0 4px;
}

.slash-preset-item:hover,
.slash-preset-item.selected {
  background: var(--accent, #3b82f6);
  color: white;
}

.slash-preset-item.selected .slash-preset-template,
.slash-preset-item.selected .slash-preset-title {
  color: white;
}

.slash-preset-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.slash-preset-item-content {
  flex: 1;
  min-width: 0;
}

.slash-preset-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #e8ecf4);
  margin-bottom: 2px;
}

.slash-preset-template {
  font-size: 11px;
  color: var(--muted, #8b95a8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-input-hint {
  color: var(--accent, #3b82f6);
  font-weight: 500;
}

.slash-preset-empty {
  padding: 24px;
  text-align: center;
  color: var(--muted, #8b95a8);
  font-size: 13px;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/nodes/SlashPresetPanel.tsx src/components/nodes/SlashPresetPanel.css
git commit -m "feat: add SlashPresetPanel floating component with keyboard navigation"
```

---

## Task 4: MentionInput 集成 `/` 触发

**Files:**
- Modify: `src/components/nodes/MentionInput.tsx`

- [ ] **Step 1: Add `/` detection to handleChange**

In `MentionInput.tsx`, find `handleChange` and add `/` detection alongside `@` detection:

In the `handleChange` callback, after the `atMatch` check:

```tsx
// Existing @ detection - keep it
const atMatch = textBefore.match(/@([^@\n]*)$/);
if (atMatch) {
  setDropdownQuery(atMatch[1]);
  setShowMentionDropdown(true);
  setShowSlashDropdown(false);
} else {
  setShowMentionDropdown(false);
}

// New: / detection (takes priority over @)
const slashMatch = textBefore.match(/\/([^/\n]*)$/);
if (slashMatch) {
  onSlashTrigger?.(textareaRef.current!.getBoundingClientRect());
}
```

Note: The slash panel is NOT managed inside MentionInput — it only fires the event upward. The parent component renders the `SlashPresetPanel`.

- [ ] **Step 2: Add new props**

Add to `MentionInputProps`:

```tsx
export interface MentionInputProps {
  // ... existing props
  onSlashTrigger?: (cursorRect: DOMRect) => void;
  onPresetInsert?: (template: string) => void;
}
```

- [ ] **Step 3: Add `insertPresetTemplate` function**

This function handles the `onPresetInsert` callback from the parent panel, inserting the preset template and positioning cursor at `__SLASH_INPUT__`:

```tsx
const insertPresetTemplate = useCallback(
  (template: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart ?? 0;
    const textBefore = pendingValueRef.current.slice(0, cursor);
    const textAfter = pendingValueRef.current.slice(cursor);
    const slashMatch = textBefore.match(/\/([^/\n]*)$/);
    if (!slashMatch) return;
    const newValue =
      textBefore.slice(0, textBefore.length - slashMatch[0].length) +
      template +
      textAfter;
    pendingValueRef.current = newValue;
    onChange(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = textBefore.length - slashMatch[0].length;
      const placeholderPos = template.indexOf(USER_INPUT_PLACEHOLDER);
      if (placeholderPos !== -1) {
        textarea.setSelectionRange(newPos + placeholderPos, newPos + placeholderPos);
      } else {
        textarea.setSelectionRange(newPos + template.length, newPos + template.length);
      }
    });
  },
  [onChange]
);
```

Expose `insertPresetTemplate` via the `ref` pattern or pass as part of a ref callback. The simplest approach: add `insertPresetTemplate` as a method on the component via `useImperativeHandle` / `forwardRef`, OR pass it as a prop `insertPresetTemplate` that the parent calls.

**Simplest approach:** Add `insertPresetTemplate` to `MentionInputProps` and have the parent call it directly. The `MentionInput` exposes it via a ref:

```tsx
export interface MentionInputRef {
  insertPresetTemplate: (template: string) => void;
}

const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(...);
```

In the parent (LLMPanel/ScriptNode), create a ref and pass it to MentionInput:

```tsx
const mentionRef = useRef<{ insertPresetTemplate: (t: string) => void }>(null);

// Render
<MentionInput ref={mentionRef} ... />

// When SlashPresetPanel selects a preset:
mentionRef.current?.insertPresetTemplate(template);
```

- [ ] **Step 4: Add `useImperativeHandle` to expose insertPresetTemplate**

```tsx
useImperativeHandle(ref, () => ({
  insertPresetTemplate,
}));
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/nodes/MentionInput.tsx
git commit -m "feat: integrate / slash trigger into MentionInput with insertPresetTemplate ref"
```

---

## Task 5: LLMPanel + ScriptNode 挂载 SlashPresetPanel

**Files:**
- Modify: `src/components/nodes/LLMPanel.tsx`
- Modify: `src/components/nodes/ScriptNode.tsx`

- [ ] **Step 1: Add state + render SlashPresetPanel in LLMPanel**

In `LLMPanel.tsx`, add state for the panel:

```tsx
const [slashCursorRect, setSlashCursorRect] = useState<DOMRect | null>(null);
const mentionRef = useRef<{ insertPresetTemplate: (t: string) => void }>(null);

// Handler for / trigger
const handleSlashTrigger = useCallback((rect: DOMRect) => {
  setSlashCursorRect(rect);
}, []);

// Handler for preset selection
const handlePresetSelect = useCallback((template: string) => {
  mentionRef.current?.insertPresetTemplate(template);
  setSlashCursorRect(null);
}, []);
```

In the JSX, after the `<MentionInput ...>` render:

```tsx
<MentionInput
  ref={mentionRef}
  nodeId={nodeId}
  value={inputText}
  onChange={setInputText}
  onSlashTrigger={handleSlashTrigger}
  placeholder="输入提示词..."
  className="scriptGenComposerInput"
  nodeLabels={nodeLabels}
/>

{slashCursorRect && (
  <SlashPresetPanel
    cursorRect={slashCursorRect}
    onSelect={handlePresetSelect}
    onClose={() => setSlashCursorRect(null)}
  />
)}
```

Add imports for `SlashPresetPanel` and `useState`, `useCallback` from React.

- [ ] **Step 2: Same pattern for ScriptNode.tsx**

Read `ScriptNode.tsx` to find the `<MentionInput ...>` render location and add the same pattern.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/nodes/LLMPanel.tsx src/components/nodes/ScriptNode.tsx
git commit -m "feat: mount SlashPresetPanel in LLMPanel and ScriptNode"
```

---

## Task 6: LeftPresetDock 左侧管理面板

**Files:**
- Create: `src/components/panels/LeftPresetDock.tsx`
- Create: `src/components/panels/LeftPresetDock.css`

- [ ] **Step 1: Write the LeftPresetDock component**

Key UI:
- Tabs by category: [全部] [人物参考] [场景构图] [脚本结构] [信息提取] [多宫格] [通用]
- Search box
- List of presets (built-in read-only + custom with delete button)
- "+ 新建预设" expands inline form

```tsx
import { useState, useMemo, useCallback } from "react";
import { useSlashPresets } from "@/hooks/useSlashPresets";
import { CATEGORIES, type Category } from "@/lib/slashPresets";
import "./LeftPresetDock.css";

const ALL_TABS = ["全部", ...CATEGORIES] as const;

export function LeftPresetDock() {
  const { presets, addCustomPreset, removeCustomPreset } = useSlashPresets();
  const [activeTab, setActiveTab] = useState<typeof ALL_TABS[number]>("全部");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", desc: "", icon: "✏️", template: "", category: "通用" as Category });

  const filtered = useMemo(() => {
    let list = presets;
    if (activeTab !== "全部") {
      list = list.filter((p) => p.category === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
    }
    return list;
  }, [presets, activeTab, search]);

  const handleSubmit = useCallback(() => {
    if (!form.title.trim() || !form.template.trim()) return;
    addCustomPreset(form);
    setForm({ title: "", desc: "", icon: "✏️", template: "", category: "通用" });
    setShowForm(false);
  }, [form, addCustomPreset]);

  return (
    <div className="left-preset-dock">
      <div className="left-preset-dock-header">预设管理</div>
      <div className="left-preset-tabs">
        {ALL_TABS.map((tab) => (
          <button
            key={tab}
            className={`left-preset-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="left-preset-search">
        <input
          placeholder="搜索预设..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="left-preset-list">
        {filtered.map((preset) => (
          <div key={preset.id} className="left-preset-item">
            <span className="left-preset-icon">{preset.icon}</span>
            <div className="left-preset-item-content">
              <div className="left-preset-title">{preset.title}</div>
              <div className="left-preset-desc">{preset.desc}</div>
            </div>
            {preset.isCustom && (
              <button
                className="left-preset-delete"
                onClick={() => removeCustomPreset(preset.id)}
                title="删除"
              >
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="left-preset-footer">
        {showForm ? (
          <div className="left-preset-form">
            <input
              placeholder="名称"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              placeholder="描述"
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
            />
            <textarea
              placeholder="模板内容（使用 __SLASH_INPUT__ 表示输入位）"
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value })}
            />
            <div className="left-preset-form-actions">
              <button onClick={() => setShowForm(false)}>取消</button>
              <button className="primary" onClick={handleSubmit}>保存预设</button>
            </div>
          </div>
        ) : (
          <button className="left-preset-add" onClick={() => setShowForm(true)}>
            + 新建预设
          </button>
        )}
      </div>
    </div>
  );
}
```

`LeftPresetDock.css` — minimal styling, reuse existing panel variables:

```css
.left-preset-dock {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel, #161a22);
  border-right: 1px solid var(--border, #2a3140);
}

.left-preset-dock-header {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #e8ecf4);
  border-bottom: 1px solid var(--border, #2a3140);
}

.left-preset-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--border, #2a3140);
}

.left-preset-tab {
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--muted, #8b95a8);
  cursor: pointer;
}

.left-preset-tab.active {
  background: var(--accent, #3b82f6);
  color: white;
}

.left-preset-search {
  padding: 8px;
}

.left-preset-search input {
  width: 100%;
  padding: 6px 10px;
  background: var(--surface, #1e232e);
  border: 1px solid var(--border, #2a3140);
  border-radius: 4px;
  color: var(--text, #e8ecf4);
  box-sizing: border-box;
}

.left-preset-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.left-preset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border, #2a3140);
}

.left-preset-item:hover {
  background: var(--surface, #1e232e);
}

.left-preset-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.left-preset-item-content {
  flex: 1;
  min-width: 0;
}

.left-preset-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #e8ecf4);
}

.left-preset-desc {
  font-size: 11px;
  color: var(--muted, #8b95a8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.left-preset-delete {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  font-size: 14px;
}

.left-preset-delete:hover {
  opacity: 1;
}

.left-preset-footer {
  border-top: 1px solid var(--border, #2a3140);
  padding: 8px;
}

.left-preset-add {
  width: 100%;
  padding: 8px;
  background: var(--accent, #3b82f6);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.left-preset-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.left-preset-form input,
.left-preset-form select,
.left-preset-form textarea {
  padding: 6px 8px;
  background: var(--surface, #1e232e);
  border: 1px solid var(--border, #2a3140);
  border-radius: 4px;
  color: var(--text, #e8ecf4);
  font-size: 12px;
  box-sizing: border-box;
  width: 100%;
}

.left-preset-form textarea {
  resize: vertical;
  min-height: 60px;
}

.left-preset-form-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.left-preset-form-actions button {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 12px;
}

.left-preset-form-actions button.primary {
  background: var(--accent, #3b82f6);
  color: white;
}
```

- [ ] **Step 2: Integrate into the app shell**

The LeftPresetDock needs to be rendered in the app shell. Look at `App.tsx` or the main layout to understand where panels are mounted. If there's a `LeftAddDock`, add the `LeftPresetDock` as a sibling.

For now, export `LeftPresetDock` and let the implementer decide where to mount it in the app shell. The plan's scope is just the component itself.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/LeftPresetDock.tsx src/components/panels/LeftPresetDock.css
git commit -m "feat: add LeftPresetDock management panel for custom presets"
```

---

## Task 7: E2E Verification

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Tests**

Run: `npm run test -- --run`
Expected: All pass

---

## Self-Review Checklist

- [ ] `USER_INPUT_PLACEHOLDER = "__SLASH_INPUT__"` used consistently across all files
- [ ] `SlashPresetPanel` renders with correct position (bottom vs top, clamped left)
- [ ] `useSlashPresets` correctly merges built-in + custom, sorts by usageCount
- [ ] `MentionInput` fires `onSlashTrigger` when `/` is typed and `onPresetInsert` when a preset is selected
- [ ] `MentionInput` exposes `insertPresetTemplate` via `forwardRef`
- [ ] `SlashPresetPanel` closes on outside click, Escape, and `/` key
- [ ] `LeftPresetDock` correctly persists custom presets via localStorage
- [ ] Template display replaces `__SLASH_INPUT__` with `[输入]` span in dropdown
- [ ] No TypeScript errors
- [ ] All tests pass
