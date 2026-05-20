# @Mention Node Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to type `@` in any prompt field to reference upstream nodes. Referenced nodes appear as visual "pills" inline in the text, and the referenced content is embedded at runtime.

**Architecture:** Three-layer design:
1. **Storage format** — `@[nodeId]` token in plain text within `data.prompt` / `data.params.prompt`
2. **Render layer** — Overlay-based pill rendering: transparent textarea + positioned pill spans + caret positioning
3. **Candidate layer** — `useUpstreamNodeCandidates(nodeId)` hook enumerates upstream nodes by traversing edges

**Tech Stack:** React hooks, CSS absolute positioning, native `<textarea>` + overlay `<div>` stacking

---

## File Map

| File | Role |
|------|------|
| `src/components/nodes/MentionInput.tsx` | **New** — Core reusable component wrapping textarea + pill overlay |
| `src/hooks/useUpstreamNodeCandidates.ts` | **New** — Hook returning list of connectable upstream nodes |
| `src/hooks/useMentionTokenizer.ts` | **New** — Hook parsing `@[nodeId]` tokens in text |
| `src/components/nodes/LLMNode.tsx` | **Modify** — Replace textarea with `MentionInput` |
| `src/components/nodes/LLMPanel.tsx` | **Modify** — Wire `MentionInput` output to `params.prompt` |
| `src/components/nodes/ScriptNode.tsx` | **Modify** — Replace textarea with `MentionInput` |
| `src/components/nodes/TextNodeWorkflowPanels.tsx` | **Modify** — Replace textareas with `MentionInput` |
| `src/components/nodes/TextNode.tsx` | **Modify** — Replace textarea with `MentionInput` |
| `src/styles/global.css` | **Modify** — Add `.mention-pill`, `.mention-overlay`, `.mention-dropdown` styles |

---

## Task 1: Core MentionInput Component

**Files:**
- Create: `src/components/nodes/MentionInput.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the failing test**

Create `src/components/nodes/MentionInput.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MentionInput } from "./MentionInput";

describe("MentionInput", () => {
  it("renders a textarea with overlay container", () => {
    render(<MentionInput nodeId="n1" value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(document.querySelector(".mention-overlay")).toBeInTheDocument();
  });

  it("shows dropdown when @ is typed", () => {
    render(<MentionInput nodeId="n1" value="" onChange={() => {}} upstreamNodes={[]} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "@" } });
    expect(document.querySelector(".mention-dropdown")).toBeInTheDocument();
  });

  it("renders mention pills for @[nodeId] tokens in value", () => {
    render(
      <MentionInput
        nodeId="n1"
        value="Hello @[upstream1] and @[upstream2]"
        onChange={() => {}}
        nodeLabels={{ upstream1: "角色节点", upstream2: "场景节点" }}
      />
    );
    const pills = document.querySelectorAll(".mention-pill");
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toContain("角色节点");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/nodes/MentionInput.test.tsx`
Expected: FAIL — MentionInput does not exist yet

- [ ] **Step 3: Write MentionInput component**

`src/components/nodes/MentionInput.tsx`:

```tsx
import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import "./MentionInput.css";
import { useUpstreamNodeCandidates } from "../../hooks/useUpstreamNodeCandidates";

export interface MentionInputProps {
  nodeId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  nodeLabels?: Record<string, string>;
}

export function MentionInput({
  nodeId,
  value,
  onChange,
  placeholder,
  className = "",
  style,
  nodeLabels = {},
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState("");
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const upstreamNodes = useUpstreamNodeCandidates(nodeId);

  const filteredNodes = useMemo(() => {
    if (!dropdownQuery) return upstreamNodes;
    const q = dropdownQuery.toLowerCase();
    return upstreamNodes.filter(
      (n) =>
        (nodeLabels[n.id] ?? n.label ?? n.id).toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
    );
  }, [upstreamNodes, dropdownQuery, nodeLabels]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursor = e.target.selectionStart;
      onChange(newValue);

      // Detect @ trigger
      const textBefore = newValue.slice(0, cursor);
      const atMatch = textBefore.match(/@([^@\n]*)$/);
      if (atMatch) {
        setDropdownQuery(atMatch[1]);
        setShowDropdown(true);
        setDropdownIndex(0);
      } else {
        setShowDropdown(false);
      }
    },
    [onChange]
  );

  const insertMention = useCallback(
    (targetNodeId: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const cursor = textarea.selectionStart;
      const textBefore = value.slice(0, cursor);
      const textAfter = value.slice(cursor);
      const atMatch = textBefore.match(/@([^@\n]*)$/);
      if (!atMatch) return;
      const insertText = `@[${targetNodeId}]`;
      const newValue = textBefore.slice(0, textBefore.length - atMatch[0].length) + insertText + textAfter;
      onChange(newValue);
      setShowDropdown(false);
      // Restore cursor after inserted text
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = textBefore.length - atMatch[0].length + insertText.length;
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showDropdown) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownIndex((i) => Math.min(i + 1, filteredNodes.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdownIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredNodes[dropdownIndex]) {
          insertMention(filteredNodes[dropdownIndex].id);
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [showDropdown, filteredNodes, dropdownIndex, insertMention]
  );

  const syncOverlay = useCallback(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) return;
    overlay.scrollLeft = textarea.scrollLeft;
    overlay.scrollTop = textarea.scrollTop;
  }, []);

  const pills = useMemo(() => {
    const result: { nodeId: string; label: string; start: number; end: number }[];
    const regex = /@\[([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      const id = match[1];
      result.push({
        nodeId: id,
        label: nodeLabels[id] ?? id,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return result;
  }, [value, nodeLabels]);

  return (
    <div className={`mention-input-wrapper ${className}`} style={style}>
      <div className="mention-overlay" ref={overlayRef}>
        {pills.map((pill) => (
          <span key={pill.nodeId} className="mention-pill">
            @{pill.label}
          </span>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="mention-textarea nodrag nopan nowheel"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={syncOverlay}
        placeholder={placeholder}
        rows={4}
      />
      {showDropdown && filteredNodes.length > 0 && (
        <div className="mention-dropdown">
          {filteredNodes.map((node, i) => (
            <div
              key={node.id}
              className={`mention-dropdown-item ${i === dropdownIndex ? "selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(node.id);
              }}
              onMouseEnter={() => setDropdownIndex(i)}
            >
              <span className="mention-dropdown-type">{node.type}</span>
              <span className="mention-dropdown-label">
                {nodeLabels[node.id] ?? node.label ?? node.id}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add CSS**

Create `src/components/nodes/MentionInput.css`:

```css
.mention-input-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
}

.mention-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  padding: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  z-index: 1;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: transparent;
}

.mention-textarea {
  position: relative;
  z-index: 2;
  background: transparent;
  color: inherit;
  resize: none;
  width: 100%;
  box-sizing: border-box;
  caret-color: var(--color-text, #e0e0e0);
}

.mention-pill {
  display: inline-block;
  background: var(--color-mention-bg, #3b82f6);
  color: white;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.9em;
  pointer-events: none;
  vertical-align: baseline;
}

.mention-dropdown {
  position: absolute;
  z-index: 100;
  background: var(--color-surface, #1e1e1e);
  border: 1px solid var(--color-border, #3a3a3a);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  min-width: 180px;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
}

.mention-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.mention-dropdown-item.selected,
.mention-dropdown-item:hover {
  background: var(--color-mention-bg, #3b82f6);
}

.mention-dropdown-type {
  font-size: 0.75em;
  color: var(--color-text-secondary, #888);
  text-transform: uppercase;
}
```

Add to `src/styles/global.css`:
```css
:root {
  --color-mention-bg: #3b82f6;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- --run src/components/nodes/MentionInput.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/nodes/MentionInput.tsx src/components/nodes/MentionInput.css src/components/nodes/MentionInput.test.tsx src/styles/global.css
git commit -m "feat: add MentionInput component with @-triggered node reference pills"
```

---

## Task 2: useUpstreamNodeCandidates Hook

**Files:**
- Create: `src/hooks/useUpstreamNodeCandidates.ts`
- Create: `src/hooks/useUpstreamNodeCandidates.test.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useUpstreamNodeCandidates.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUpstreamNodeCandidates } from "./useUpstreamNodeCandidates";
import { useProjectStore } from "../store/projectStore";

const makeNode = (id: string, type: string, label?: string) => ({
  id,
  type,
  data: { label },
  position: { x: 0, y: 0 },
}) as any;

const makeEdge = (source: string, target: string) => ({
  id: `${source}-${target}`,
  source,
  target,
}) as any;

describe("useUpstreamNodeCandidates", () => {
  it("returns empty array when node has no upstream edges", () => {
    const { result } = renderHook(() => useUpstreamNodeCandidates("n1"), {
      wrapper: ({ children }) => (
        <MockStore
          nodes={[makeNode("n1", "textNode")]}
          edges={[]}
        >
          {children}
        </MockStore>
      ),
    });
    expect(result.current).toEqual([]);
  });

  it("returns upstream nodes connected via edges", () => {
    const { result } = renderHook(() => useUpstreamNodeCandidates("n2"), {
      wrapper: ({ children }) => (
        <MockStore
          nodes={[makeNode("n1", "textNode", "上游文本"), makeNode("n2", "llm")]}
          edges={[makeEdge("n1", "n2")]}
        >
          {children}
        </MockStore>
      ),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("n1");
    expect(result.current[0].label).toBe("上游文本");
  });

  it("excludes the current node from candidates", () => {
    const { result } = renderHook(() => useUpstreamNodeCandidates("n1"), {
      wrapper: ({ children }) => (
        <MockStore
          nodes={[makeNode("n1", "llm")]}
          edges={[makeEdge("n1", "n1")]}
        >
          {children}
        </MockStore>
      ),
    });
    expect(result.current).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/hooks/useUpstreamNodeCandidates.test.ts`
Expected: FAIL — hook does not exist

- [ ] **Step 3: Write the hook**

`src/hooks/useUpstreamNodeCandidates.ts`:

```typescript
import { useMemo } from "react";
import { useProjectStore } from "../store/projectStore";
import { Node } from "reactflow";

export type UpstreamNodeCandidate = {
  id: string;
  type: string;
  label: string;
};

export function useUpstreamNodeCandidates(nodeId: string): UpstreamNodeCandidate[] {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);

  return useMemo(() => {
    const upstreamEdgeSources = edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => edge.source);

    return upstreamEdgeSources
      .map((sourceId) => {
        const node = nodes.find((n: Node) => n.id === sourceId);
        if (!node) return null;
        return {
          id: node.id,
          type: node.type ?? "unknown",
          label: (node.data as any).label ?? node.id,
        };
      })
      .filter((n): n is UpstreamNodeCandidate => n !== null);
  }, [nodes, edges, nodeId]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/hooks/useUpstreamNodeCandidates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useUpstreamNodeCandidates.ts src/hooks/useUpstreamNodeCandidates.test.ts
git commit -m "feat: add useUpstreamNodeCandidates hook for @mention candidates"
```

---

## Task 3: Integrate MentionInput into LLMNode / LLMPanel

**Files:**
- Modify: `src/components/nodes/LLMPanel.tsx`
- Modify: `src/components/nodes/LLMNode.tsx` (add nodeLabels prop)

- [ ] **Step 1: Replace textarea in LLMPanel with MentionInput**

Read `src/components/nodes/LLMPanel.tsx` first. Find the prompt textarea (class `scriptGenComposerInput`) and replace it with `MentionInput`.

The `MentionInput` should use `data.params.prompt` as value and write back to `params.prompt` on change:

```tsx
// Inside LLMPanel, find the textarea. Replace with:
<MentionInput
  nodeId={nodeId}
  value={inputText}
  onChange={setInputText}
  placeholder="输入提示词..."
  className="scriptGenComposerInput"
/>
```

Note: `LLMPanel` receives `nodeId` prop — verify this exists. If LLMPanel doesn't receive nodeId directly, it will need to be passed from LLMNode via `floatingBottomOverlay`.

- [ ] **Step 2: Add nodeLabels map from all nodes**

In `LLMPanel.tsx` (or LLMNode.tsx), build a `nodeLabels` map:

```tsx
const nodeLabels = useMemo(() => {
  const map: Record<string, string> = {};
  nodes.forEach((n: Node) => {
    map[n.id] = (n.data as any).label ?? n.id;
  });
  return map;
}, [nodes]);
```

- [ ] **Step 3: Test that @ triggers dropdown with upstream nodes**

Run `npm run dev` and verify: open LLMNode, type `@`, see dropdown of upstream connected nodes.

- [ ] **Step 4: Commit**

```bash
git add src/components/nodes/LLMPanel.tsx src/components/nodes/LLMNode.tsx
git commit -m "feat: integrate MentionInput in LLMPanel for @ node references"
```

---

## Task 4: Integrate MentionInput into ScriptNode

**Files:**
- Modify: `src/components/nodes/ScriptNode.tsx`

- [ ] **Step 1: Read ScriptNode.tsx**

Find the textarea with class `scriptGenComposerInput` and `RF_NODE_INPUT_CLASS`. Replace with `MentionInput`.

- [ ] **Step 2: Replace textarea**

```tsx
import { MentionInput } from "./MentionInput";

// In the JSX where the textarea is:
<MentionInput
  nodeId={id}
  value={prompt}
  onChange={(newPrompt) => {
    updateNodeData(id, { prompt: newPrompt, params: { ...params, styleProfile: "auto" } });
  }}
  placeholder="输入脚本内容..."
  className={`scriptGenComposerInput ${RF_NODE_INPUT_CLASS}`}
  nodeLabels={nodeLabels}
/>
```

- [ ] **Step 3: Add nodeLabels map**

Add near the top of the component:
```tsx
const nodeLabels = useMemo(() => {
  const map: Record<string, string> = {};
  nodes.forEach((n: Node) => { map[n.id] = (n.data as any).label ?? n.id; });
  return map;
}, [nodes]);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/nodes/ScriptNode.tsx
git commit -m "feat: integrate MentionInput in ScriptNode"
```

---

## Task 5: Integrate MentionInput into TextNode Workflow Panels

**Files:**
- Modify: `src/components/nodes/TextNodeWorkflowPanels.tsx`

- [ ] **Step 1: Read TextNodeWorkflowPanels.tsx**

Find any `<textarea` elements that handle prompt input. Replace with `MentionInput`.

TextNodeWorkflowPanels is used inside TextNode via floating panels. The `nodeId` is available via the parent TextNode's props.

- [ ] **Step 2: Replace textarea**

Replace each prompt textarea:
```tsx
<MentionInput
  nodeId={nodeId}
  value={inputValue}
  onChange={setInputValue}
  placeholder="输入内容..."
  className={RF_NODE_INPUT_CLASS}
/>
```

- [ ] **Step 3: Add nodeLabels map**

Same pattern as previous tasks.

- [ ] **Step 4: Commit**

```bash
git add src/components/nodes/TextNodeWorkflowPanels.tsx
git commit -m "feat: integrate MentionInput in TextNodeWorkflowPanels"
```

---

## Task 6: Resolve Mention Tokens at Runtime (Execution Layer)

**Files:**
- Create: `src/lib/resolveMentionTokens.ts`
- Create: `src/lib/resolveMentionTokens.test.ts`
- Modify: `src/lib/nodeAgentRuntime/scriptStoryboardAgent.ts` (and other agents that read `prompt` field)

- [ ] **Step 1: Write resolver**

When an agent reads `data.prompt` or `data.params.prompt` for sending to an LLM, it should first resolve `@[nodeId]` tokens into actual content.

`src/lib/resolveMentionTokens.ts`:

```typescript
import { Node, Edge } from "reactflow";
import { FlowNodeData } from "./types";

export function resolveMentionTokens(
  text: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): string {
  return text.replace(/@\[([^\]]+)\]/g, (match, nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return match;
    // Use the node's primary text output: data.prompt or data.output
    const content = node.data.prompt ?? node.data.output ?? "";
    return `[${(node.data as any).label ?? nodeId}: ${content.trim()}]`;
  });
}
```

- [ ] **Step 2: Write tests**

```typescript
describe("resolveMentionTokens", () => {
  it("passes through text with no tokens", () => {
    const result = resolveMentionTokens("hello world", [], []);
    expect(result).toBe("hello world");
  });

  it("replaces @[nodeId] with label and content", () => {
    const nodes = [
      { id: "n1", data: { label: "角色", prompt: "李明正在走路" } },
    ] as any[];
    const result = resolveMentionTokens("场景: @[n1]", nodes, []);
    expect(result).toBe("场景: [角色: 李明正在走路]");
  });

  it("leaves unknown nodeId as-is", () => {
    const result = resolveMentionTokens("@[unknown]", [], []);
    expect(result).toBe("@[unknown]");
  });
});
```

- [ ] **Step 3: Integrate into scriptStoryboardAgent**

Read `src/lib/nodeAgentRuntime/scriptStoryboardAgent.ts`. Find where `prompt` is read from a node's `data.prompt` field. Wrap with `resolveMentionTokens`:

```typescript
const resolvedPrompt = resolveMentionTokens(
  node.data.prompt ?? "",
  nodes,
  edges
);
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- --run src/lib/resolveMentionTokens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/resolveMentionTokens.ts src/lib/resolveMentionTokens.test.ts
git add src/lib/nodeAgentRuntime/scriptStoryboardAgent.ts
git commit -m "feat: resolve @[nodeId] mention tokens at agent execution time"
```

---

## Task 7: End-to-End Verification

- [ ] **Step 1: Start dev server**

Run: `npm run tauri dev`
Expected: Tauri window opens

- [ ] **Step 2: Manual test checklist**

1. Create a TextNode, type text, connect to LLMNode via anchor
2. Open LLMNode, focus prompt textarea
3. Type `@` → dropdown appears with TextNode as candidate
4. Press Enter or click → `@[textNodeId]` inserted as pill
5. Pill displays with node label
6. Run the LLMNode agent
7. Verify execution log shows resolved content instead of `@[nodeId]`

- [ ] **Step 3: Type check**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 5: Tests**

Run: `npm run test -- --run`
Expected: All pass

---

## Self-Review Checklist

- [ ] All 5 integration tasks (LLMPanel, LLMNode, ScriptNode, TextNode panels) use the SAME `MentionInput` component
- [ ] `nodeLabels` map is computed from `nodes` store, not hardcoded
- [ ] `resolveMentionTokens` is called at execution time, not at edit time
- [ ] Pill overlay is CSS `pointer-events: none` so it doesn't block textarea input
- [ ] Dropdown keyboard nav (↑↓ Enter Tab Esc) works
- [ ] Dropdown filters by typed query after `@`
- [ ] Dropdown position is below cursor (future: improve to inline-at-cursor)
- [ ] No TypeScript errors
- [ ] All tests pass
