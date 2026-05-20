# Node Sizing Redesign Design Spec

## Overview

Redesign canvas node dimensions to follow macOS HIG principles with consistent sizing hierarchy and overflow handling.

## Design Principles

1. **Height by complexity**: Three tiers based on content needs
2. **Width by role**: Two fixed widths (narrow 280px, wide 400px)
3. **Overflow via scroll + fullscreen**: Content beyond height limit scrolls internally; nodes with complex content get fullscreen expansion
4. **8px grid**: All spacing in multiples of 8px

---

## Dimensions

### Height Tiers

| Level | Height | Nodes | Description |
|-------|--------|-------|-------------|
| Base | 80px | MediaImport, Audio | Simple media cards |
| Standard | 120px | Text, LLM | Has editor panel |
| Extended | 160px | Script, Video | Complex content, fullscreen available |

### Width Tiers

| Width | Nodes |
|-------|-------|
| 280px (narrow) | MediaImport, Audio |
| 400px (wide) | Text, LLM, Script, Video |

### Visual Constants

- **Corner radius**: 10px (macOS standard)
- **Horizontal padding**: 12px
- **Vertical padding**: 8px
- **Grid**: 8px

---

## Overflow Strategy

### Internal Scroll
- All nodes with content > height limit get `overflow-y: auto`
- Scrollbar styled to match dark theme

### Fullscreen Button
- Trigger: Nodes with "Extended" height (160px)
- Position: Bottom-right corner, floating
- Icon: Expand icon (macOS style)
- Behavior: Opens fullscreen overlay with complete content

---

## CSS Changes

### .nodeCard
```css
.nodeCard {
  min-width: [narrow|wide per type];
  max-width: [same as min-width - fixed width];
  height: [80|120|160]px;
  border-radius: 10px;
  overflow: hidden; /* clip children, scroll inside */
}
```

### Content zones inside node
```css
.nodeBody {
  height: [height - title-height]px;
  overflow-y: auto;
}
```

---

## Implementation Order

1. Update `global.css` node card dimensions
2. Update `NodeFrame.tsx` to handle overflow properly
3. Add fullscreen buttons to ScriptNode and VideoNode
4. Test each node type at various content lengths