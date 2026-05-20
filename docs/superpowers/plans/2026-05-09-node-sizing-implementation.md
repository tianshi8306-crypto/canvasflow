# Node Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign canvas node dimensions following macOS HIG with three height tiers and two width tiers.

**Architecture:** Update global.css node dimension tokens, then update each node component's specific CSS. Content overflow handled via internal scroll + fullscreen button for complex nodes.

**Tech Stack:** CSS (global.css), React Node components

---

## File Structure

- Modify: `src/styles/global.css` (lines ~1391-2100)
- Modify: `src/components/nodes/NodeFrame.tsx` (overflow handling)
- Check: `src/components/ScriptNodeFullscreenOverlay.tsx` (exists for script fullscreen)
- Check: `src/components/nodes/VideoAssetNode.tsx` (add fullscreen if missing)

---

## Dimensions Reference

| Node Type | Width | Height | Fullscreen |
|-----------|-------|--------|-----------|
| mediaImport | 280px | 80px | No |
| audio | 280px | 80px | No |
| text | 400px | 120px | No |
| llm | 400px | 120px | No |
| video | 400px | 160px | Yes |
| script | 400px | 160px | Yes |

---

## Tasks

### Task 1: Update .nodeCard base styles

**Files:**
- Modify: `src/styles/global.css:1391-1400`

- [ ] **Step 1: Update .nodeCard base**

```css
.nodeCard {
  position: relative;
  width: [varies by type];
  height: [varies by type];
  border-radius: 10px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, #151c27, #111722);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  overflow: hidden; /* clip children, scroll inside */
  transition: border-color 140ms ease;
}
```

- [ ] **Step 2: Update .nodeBody to handle scroll**

Find `.nodeBody` in global.css and ensure:
```css
.nodeBody {
  height: calc(100% - [title-height]);
  overflow-y: auto;
  overflow-x: hidden;
}
```

---

### Task 2: Update narrow-width nodes (80px height)

**Files:**
- Modify: `src/styles/global.css:1984-2007` (mediaImportCard)
- Modify: `src/styles/global.css` (audioNode - find and update)

- [ ] **Step 1: Update .mediaImportCard.nodeCard**

```css
.mediaImportCard.nodeCard {
  width: 280px;
  height: 80px;
  min-width: 280px;
  max-width: 280px;
  overflow: visible;
}
```

- [ ] **Step 2: Add .audioNodeCard.nodeCard styles**

Find audio node styles (likely near videoAssetCard or create new):
```css
.audioNodeCard.nodeCard {
  width: 280px;
  height: 80px;
  min-width: 280px;
  max-width: 280px;
  overflow: visible;
}
```

---

### Task 3: Update standard-height nodes (120px)

**Files:**
- Modify: `src/styles/global.css:1964-1968` (llmNodeCard)
- Modify: `src/styles/global.css:2103-2120` (textNodeCard)

- [ ] **Step 1: Update .llmNodeCard.nodeCard**

```css
.llmNodeCard.nodeCard {
  width: 400px;
  height: 120px;
  min-width: 400px;
  max-width: 400px;
  overflow: visible;
}
```

- [ ] **Step 2: Update .textNodeCard.nodeCard**

```css
.textNodeCard.nodeCard {
  width: 400px;
  height: 120px;
  min-width: 400px;
  max-width: 400px;
  overflow: visible;
}

/* Remove fixed min-height: 300px */
.textNodeCard.nodeCard:not(.textNodeCard--hasBody) {
  min-height: 120px; /* Same as other nodes */
}
```

---

### Task 4: Update extended-height nodes (160px + fullscreen)

**Files:**
- Modify: `src/styles/global.css:2045-2100` (videoAssetCard)
- Modify: `src/styles/global.css` (scriptGenNode - find and update)

- [ ] **Step 1: Update .videoAssetCard.nodeCard**

```css
.videoAssetCard.nodeCard {
  width: 400px;
  height: 160px;
  min-width: 400px;
  max-width: 400px;
  overflow: visible;
}
```

- [ ] **Step 2: Update .scriptGenNode.nodeCard**

Find script node styles and update:
```css
.nodeCard.scriptGenNode.nodeCard {
  width: 400px;
  height: 160px;
  min-width: 400px;
  max-width: 400px;
  overflow: visible;
}
```

- [ ] **Step 3: Add fullscreen button styles for video**

```css
.videoFullscreenBtn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--canvas-float-border);
  background: var(--canvas-float-bg);
  color: var(--muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 140ms ease;
}

.videoAssetCard:hover .videoFullscreenBtn {
  opacity: 1;
}

.videoFullscreenBtn:hover {
  background: var(--canvas-float-hover);
  color: var(--text);
}
```

---

### Task 5: Update NodeFrame for overflow handling

**Files:**
- Modify: `src/components/nodes/NodeFrame.tsx`

- [ ] **Step 1: Check and update overflow handling in NodeFrame**

In NodeFrame, ensure the body/content area handles overflow properly. The `children` prop or `upperBody`/`lowerBody` should be wrapped with overflow: hidden and scroll.

```tsx
// In NodeFrame return block, ensure .nodeBody has overflow handling
// Look for the return statement and add proper overflow styling via className
```

---

### Task 6: Add fullscreen button to VideoAssetNode

**Files:**
- Modify: `src/components/nodes/VideoAssetNode.tsx`

- [ ] **Step 1: Add fullscreen button to VideoAssetNode**

Add a fullscreen expansion button (similar to how ScriptNode has ScriptNodeFullscreenOverlay).

---

## Verification

- [ ] Run `npm run typecheck` to verify no TypeScript errors
- [ ] Run `npm run lint` to verify no lint errors
- [ ] Run `npm run dev` and manually verify:
  - All nodes display at correct fixed dimensions
  - Content overflow shows scrollbar
  - Script and Video nodes have fullscreen buttons
  - Fullscreen buttons open proper overlays