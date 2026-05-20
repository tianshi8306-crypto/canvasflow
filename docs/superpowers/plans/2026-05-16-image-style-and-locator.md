# 图片节点风格 + 画布定位功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为图片节点生成面板添加风格选择功能（通过 prompt 后缀注入实现）和画布定位按钮（帮助在大画布上快速找到正在编辑的图片节点）。

**Architecture:**
1. **风格机制**：不使用 API 参数（Seedream-5.0-lite 不支持 style_preset），改为在生成时将风格详细描述词追加到用户 prompt 末尾，通过文本引导模型生成对应画风。选择风格后以 chip 标签出现在输入区下方。
2. **画布定位**：面板上的"定位"按钮将当前图片节点 id 写入 `canvasUiStore.markedNodeId`，在画布上方渲染悬浮导航条（定位按钮 + 退出按钮），点击后飞焦到目标节点并自动选中文档。

---

## Task 1: 风格描述词数据与多选机制

**Files:**
- Modify: `src/lib/imageGeneration/catalog.ts`
- Modify: `src/components/nodes/ImageGenerationPanel.tsx`
- Modify: `src/components/nodes/MinimalImageNode.css`

---

- [ ] **Step 1: 更新 catalog.ts — 替换风格选项为完整中文场景风格集**

将 `IMAGE_STYLE_OPTIONS` 从 7 个选项扩展为中文场景覆盖更广的 14 个选项，并新增 `IMAGE_STYLE_PROMPTS` 映射表（含详细描述词）。

```typescript
// src/lib/imageGeneration/catalog.ts

export type ImageStyleId =
  | "photorealistic" | "anime" | "oil_painting" | "watercolor"
  | "cyberpunk" | "fantasy" | "illustration" | "film_photo"
  | "90s_anime" | "guoman" | "cinematic" | "stop_motion" | "cel_style"
  | "archival_photo";

export const IMAGE_STYLE_OPTIONS: Array<{ id: ImageStyleId; label: string; icon: string }> = [
  { id: "photorealistic", label: "写实摄影", icon: "📷" },
  { id: "anime", label: "动漫", icon: "🎨" },
  { id: "oil_painting", label: "油画", icon: "🖼️" },
  { id: "watercolor", label: "水彩", icon: "🎨" },
  { id: "cyberpunk", label: "赛博朋克", icon: "🌃" },
  { id: "fantasy", label: "奇幻", icon: "✨" },
  { id: "illustration", label: "插画", icon: "✏️" },
  { id: "film_photo", label: "胶片摄影", icon: "📽️" },
  { id: "90s_anime", label: "90s日漫", icon: "📼" },
  { id: "guoman", label: "国漫", icon: "🦊" },
  { id: "cinematic", label: "电影质感", icon: "🎬" },
  { id: "stop_motion", label: "定格动画", icon: "🎭" },
  { id: "cel_style", label: "赛璐璐", icon: "💿" },
  { id: "archival_photo", label: "复古档案", icon: "📚" },
];

export const IMAGE_STYLE_PROMPTS: Record<ImageStyleId, string> = {
  "photorealistic":
    "photorealistic, 8K ultra HD, natural lighting, shallow depth of field, professional photography, sharp focus, accurate skin texture, natural colors",
  "anime":
    "anime style, cel shading, vibrant colors, Japanese animation aesthetic, clean linework, expressive eyes, stylized character design",
  "oil_painting":
    "oil painting on canvas, visible brushstrokes, rich texture, classical art technique, museum quality, warm color palette, chiaroscuro lighting",
  "watercolor":
    "watercolor painting, soft edges, translucent color layers, delicate bleeding effect, artistic paper texture, gentle atmosphere, minimalist composition",
  "cyberpunk":
    "cyberpunk, neon lights, holographic projections, futuristic city at night, chrome reflections, rain-soaked streets, volumetric fog, dystopian atmosphere",
  "fantasy":
    "fantasy art, ethereal lighting, mystical atmosphere, enchanted forest, magical creatures, epic composition, digital painting, ornate details",
  "illustration":
    "digital illustration, detailed linework, vibrant colors, graphic novel style, clean rendering, comic book aesthetic, bold outlines, dynamic composition",
  "film_photo":
    "film photography, grain texture, flash exposure, faded tones, low saturation, cinematic mood, vintage color grading, halation effect, documentary style",
  "90s_anime":
    "90s Japanese anime style, retro anime aesthetic, hand-drawn animation feel, classic VHS quality, nostalgic atmosphere, cel animation look, slightly pixelated",
  "guoman":
    "Chinese comic style, bold linework, vivid colors, manga aesthetic, dynamic composition, xianxia atmosphere, ink wash texture, traditional elements",
  "cinematic":
    "cinematic, film-grade cinematography, dramatic lighting, anamorphic lens flare, 2.35:1 widescreen aspect, color grading, film grain, studio quality",
  "stop_motion":
    "stop motion animation style, claymation aesthetic, puppetry texture, handcrafted feel, slightly rough edges, frame-by-frame motion, toy-like characters",
  "cel_style":
    "cel shading animation, flat colors, clean outlines, 2D cartoon style, vector art aesthetic, bold graphic design, comic panel composition",
  "archival_photo":
    "archival photograph, aged photo paper, sepia tones, scratched surface, vintage archive aesthetic, historical document feel, faded ink stamps, nostalgic atmosphere",
};
```

---

- [ ] **Step 2: 更新 IMAGE_STYLE_OPTIONS — 添加 icon 字段并移除旧选项**

```typescript
// 删除旧的 IMAGE_STYLE_OPTIONS 和 ImageStyleId 类型定义
// 替换为上方 Step 1 中的完整代码
```

---

- [ ] **Step 3: 更新 ImageGenerationPanel — 将风格改为多选 chip 机制**

将当前单选风格网格替换为"已选风格 chip 列表 + 添加按钮"的多选交互：

```tsx
// src/components/nodes/ImageGenerationPanel.tsx
// 在 state 声明区，将：
//   const [style, setStyle] = useState<ImageStyleId | "">("");
//   const [showStyle, setShowStyle] = useState(false);
// 替换为：
const [selectedStyles, setSelectedStyles] = useState<ImageStyleId[]>([]);
const [showStylePanel, setShowStylePanel] = useState(false);
```

```tsx
// 替换风格选择区域（原来在负面词下方），改为 chip 列表：
{/* 已选风格 chip 列表 */}
{selectedStyles.length > 0 && (
  <div className="igp-style-chips">
    {selectedStyles.map((sid) => {
      const opt = IMAGE_STYLE_OPTIONS.find((o) => o.id === sid)!;
      return (
        <span key={sid} className="igp-style-chip">
          {opt.label}
          <button
            type="button"
            className="igp-style-chip-remove"
            onClick={() => setSelectedStyles((prev) => prev.filter((s) => s !== sid))}
          >
            ✕
          </button>
        </span>
      );
    })}
  </div>
)}

{/* 添加风格按钮 */}
<button
  type="button"
  className={`igp-add-style-btn${showStylePanel ? " active" : ""}`}
  onClick={() => setShowStylePanel((v) => !v)}
>
  + 添加风格
</button>

{/* 风格选择下拉网格（可多选） */}
{showStylePanel && (
  <div className="igp-style-panel">
    {IMAGE_STYLE_OPTIONS.map((opt) => {
      const checked = selectedStyles.includes(opt.id);
      return (
        <button
          key={opt.id}
          type="button"
          className={`igp-style-option-btn${checked ? " selected" : ""}`}
          onClick={() => {
            setSelectedStyles((prev) =>
              checked ? prev.filter((s) => s !== opt.id) : [...prev, opt.id],
            );
          }}
        >
          <span className="igp-style-option-icon">{opt.icon}</span>
          <span className="igp-style-option-label">{opt.label}</span>
          {checked && <span className="igp-style-option-check">✓</span>}
        </button>
      );
    })}
  </div>
)}
```

---

- [ ] **Step 4: 更新生成逻辑 — 将风格描述词追加到 prompt**

```tsx
// onGenerate 中，将：
//   style: style || undefined,
// 替换为：
// 将已选风格的描述词追加到 prompt 末尾
const styleSuffix = selectedStyles
  .map((sid) => `[${IMAGE_STYLE_PROMPTS[sid]}]`)
  .join(" ");
const finalPrompt = enhancedPrompt + (styleSuffix ? "\n\nStyle: " + styleSuffix : "");
// 将 finalPrompt 作为 prompt 参数传入 runNodeTaskAgent
```

同时将 `ImageGenerationAgentInput` 中的 `style` 类型从 `string` 改为 `string[]`，并更新 agent 的 sense/execute 链路传递 `selectedStyles` 描述词数组而非单个 style ID。

---

- [ ] **Step 5: 更新 MinimalImageNode.css — 添加 chip 和风格面板样式**

```css
/* 已选风格 chip 列表 */
.imageGenPanel--minimal .igp-style-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.imageGenPanel--minimal .igp-style-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  font-size: 12px;
  color: #E0E0E0;
}

.imageGenPanel--minimal .igp-style-chip-remove {
  background: none;
  border: none;
  color: #9E9E9E;
  cursor: pointer;
  font-size: 10px;
  padding: 0;
  line-height: 1;
}

.imageGenPanel--minimal .igp-style-chip-remove:hover {
  color: #E0E0E0;
}

/* 添加风格按钮 */
.imageGenPanel--minimal .igp-add-style-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  background: transparent;
  border-radius: 20px;
  cursor: pointer;
  color: #616161;
  font-size: 12px;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
}

.imageGenPanel--minimal .igp-add-style-btn:hover,
.imageGenPanel--minimal .igp-add-style-btn.active {
  color: #9E9E9E;
  border-color: rgba(255, 255, 255, 0.3);
}

/* 风格选择下拉面板 */
.imageGenPanel--minimal .igp-style-panel {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 10px;
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.imageGenPanel--minimal .igp-style-option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  background: #1A1A1A;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  color: #9E9E9E;
  font-size: 12px;
  font-family: inherit;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  position: relative;
}

.imageGenPanel--minimal .igp-style-option-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #E0E0E0;
}

.imageGenPanel--minimal .igp-style-option-btn.selected {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.35);
  color: #E0E0E0;
}

.imageGenPanel--minimal .igp-style-option-icon {
  font-size: 18px;
}

.imageGenPanel--minimal .igp-style-option-label {
  font-size: 11px;
  text-align: center;
}

.imageGenPanel--minimal .igp-style-option-check {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 10px;
  color: #4ade80;
}
```

---

## Task 2: 画布定位功能（标记按钮 → 全局导航条）

**Files:**
- Modify: `src/components/nodes/ImageGenerationPanel.tsx`
- Modify: `src/components/nodes/MinimalImageNode.css`
- Modify: `src/store/canvasUiStore.ts`
- Create: `src/components/CanvasNodeLocator.tsx`

---

- [ ] **Step 1: 更新 canvasUiStore — 将 markedNodeId 重命名为 nodeLocatorId（语义更明确）**

```typescript
// src/store/canvasUiStore.ts

// 替换 markedNodeId 相关定义：
// 之前：
//   markedNodeId: string | null;
//   setMarkedNodeId: (id: string | null) => void;
// 替换为：
nodeLocatorId: string | null;
setNodeLocatorId: (id: string | null) => void;

// 在初始状态处：
nodeLocatorId: null,
setNodeLocatorId: (id) => set({ nodeLocatorId: id }),
```

---

- [ ] **Step 2: 创建 CanvasNodeLocator 导航条组件**

```tsx
// src/components/CanvasNodeLocator.tsx

import { useEffect } from "react";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { useReactFlow } from "@xyflow/react";

export function CanvasNodeLocator() {
  const nodeLocatorId = useCanvasUiStore((s) => s.nodeLocatorId);
  const setNodeLocatorId = useCanvasUiStore((s) => s.setNodeLocatorId);
  const nodes = useProjectStore((s) => s.nodes);
  const { fitView, setCenter } = useReactFlow();

  const node = nodeLocatorId ? nodes.find((n) => n.id === nodeLocatorId) : null;

  useEffect(() => {
    if (!nodeLocatorId || !node) return;
    // 飞焦到目标节点：先 fitView 再居中
    const el = document.querySelector(`[data-id="${nodeLocatorId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [nodeLocatorId, node]);

  if (!nodeLocatorId || !node) return null;

  const label = node.data.label ?? node.id;

  return (
    <div className="canvas-node-locator">
      <div className="canvas-node-locator-inner">
        <button
          type="button"
          className="canvas-node-locator-btn"
          onClick={() => {
            // 飞焦到节点并选中
            const el = document.querySelector(`[data-id="${nodeLocatorId}"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          }}
        >
          📍 定位到「{label}」
        </button>
        <button
          type="button"
          className="canvas-node-locator-close"
          onClick={() => setNodeLocatorId(null)}
          title="退出定位"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
```

---

- [ ] **Step 3: 在 FlowCanvas 中挂载 CanvasNodeLocator**

```tsx
// src/components/FlowCanvas.tsx
// 找到 <NodeMaximizedOverlay /> 并在其后添加：
<NodeMaximizedOverlay />
<CanvasNodeLocator />
```

---

- [ ] **Step 4: 更新 ImageGenerationPanel — 将"标记"按钮改为"定位"触发器**

```tsx
// 在 igp-toolbar-top 中，替换原来的"标记"按钮：
<button
  type="button"
  title="定位节点（画布导航）"
  className="igp-icon-btn"
  onClick={() => {
    useCanvasUiStore.getState().setNodeLocatorId(nodeId);
  }}
>
  <svg viewBox="0 0 24 24">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
  <span>定位</span>
</button>
```

---

- [ ] **Step 5: 添加 CanvasNodeLocator CSS**

```css
/* src/components/canvas/CanvasNodeLocator.css */

.canvas-node-locator {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
}

.canvas-node-locator-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1A1A1A;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  padding: 8px 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  pointer-events: all;
}

.canvas-node-locator-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  color: #E0E0E0;
  font-size: 13px;
  font-family: inherit;
  padding: 4px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.canvas-node-locator-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.canvas-node-locator-close {
  background: none;
  border: none;
  color: #616161;
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
  transition: color 0.15s;
}

.canvas-node-locator-close:hover {
  color: #9E9E9E;
}
```

---

## Task 3: 更新 imageGenerationAgent — 支持多风格 prompt 注入

**Files:**
- Modify: `src/lib/nodeAgentRuntime/imageGenerationAgent.ts`
- Modify: `src-tauri/src/commands/media_gen_cmd.rs`

---

- [ ] **Step 1: 更新 ImageGenerationAgentInput — 将 style 改为 string[]**

```typescript
// src/lib/nodeAgentRuntime/imageGenerationAgent.ts

// 将：
//   style?: string;
// 替换为：
// 多风格描述词数组（由已选风格 ID 查表得到详细描述后传入）
stylePrompts?: string[];
```

同时更新 `ImageGenerationSensed` 的类型。

---

- [ ] **Step 2: 更新 execute — 将风格描述词注入 prompt**

在 invoke 调用 `generate_image_asset` 时，将 `stylePrompts` 合并到 prompt 中（在后端处理）：

```typescript
// 在 execute 的 invoke 调用中追加 stylePrompts
// 如果有 stylePrompts，将其追加到 prompt 末尾
const finalPrompt = sensed.prompt + (sensed.stylePrompts?.length
  ? "\n\nStyle: " + sensed.stylePrompts.join(" ")
  : "");

await invoke<string>("generate_image_asset", {
  // ...其他参数
  prompt: finalPrompt,
  // stylePrompts 已在 prompt 中合并，不再单独传
});
```

---

- [ ] **Step 3: 更新 ImageGenerationPanel — 传入风格描述词数组**

```tsx
// onGenerate 中，将：
//   style: style || undefined,
// 替换为：
stylePrompts: selectedStyles.map((sid) => IMAGE_STYLE_PROMPTS[sid]),
```

---

## Task 4: 测试验证

---

- [ ] **Step 1: TypeScript 检查**

```bash
npx tsc --noEmit
```
预期：改动文件（catalog.ts、ImageGenerationPanel.tsx、imageGenerationAgent.ts）无错误。

- [ ] **Step 2: Rust 检查**

```bash
cd src-tauri && cargo check
```
预期：通过，无新警告。

- [ ] **Step 3: 功能验证清单**

1. 风格选择：点击"添加风格"→ 展开 14 风格网格 → 勾选多个风格 → chip 出现在输入区 → chip 可单独移除
2. 生成测试：选"动漫"+输入"猫" → 生成图片应为动漫风格（对比不选风格）
3. 画布定位：点击"定位"按钮 → 画布顶部出现导航条 → 点击"定位到"飞焦到节点 → 点 ✕ 消失
4. 多风格组合：选"油画"+ "奇幻" → 描述词应正确追加到 prompt

---

## Out of Scope

- "展开面板"按钮的后续完整功能（本次仅实现双击节点最大化）
- 其他节点类型的风格功能

## Manual Acceptance Steps

1. 打开 CanvasFlow，创建或打开一个项目
2. 添加一个图片节点，选中它使生成面板出现
3. 测试"添加风格"：选择"动漫"，输入提示词"一只猫"，点击生成，验证图片为动漫风格
4. 测试"定位"按钮：点击"定位"→ 画布顶部出现导航条 → 拖动画布后点击导航条按钮验证飞焦
5. 多风格：选"电影质感"+ "胶片摄影"，验证 chip 多选共存

## Rollback Trigger/Action

若出现风格 chip 不消失或定位按钮无效的问题：
1. 检查 `selectedStyles` state 是否在选择时正确更新
2. 检查 `canvasUiStore.nodeLocatorId` 是否被正确写入
3. 检查 `CanvasNodeLocator` 是否正确挂载在 `FlowCanvas` 中