# 锚点设计方案

## 一、现状分析

### 当前架构

| 组件 | 职责 |
|------|------|
| `MagneticNodeAnchors` | 锚点 + 感应区 + 弹出菜单 |
| `AnchorSide` | 单侧锚点逻辑（内部组件） |
| `flowMagnetZone` | CSS 感应区，覆盖节点边缘 20px |
| `flowMagnetKnobWrap` | 锚点包装器 |
| `nodeAnchorPopover` | 锚点点击弹出的菜单 |

### 当前问题

1. **组件过于复杂** - `MagneticNodeAnchors` 包含菜单、状态管理、位置计算等多重职责
2. **耦合过紧** - 锚点系统和菜单系统无法分离
3. **极简节点无法使用** - `MinimalImageNode` 想要的简单锚点（无菜单）和当前复杂锚点冲突
4. **样式扩展困难** - 全局 `.react-flow__handle` 样式会影响所有节点

---

## 二、设计目标

参考 AI-CanvasPro 锚点交互：

1. **视觉简洁** - 圆形边框 + 符号，默认隐藏
2. **hover 显示** - 鼠标悬停时显示锚点
3. **吸附跟随** - 拖拽连线时锚点有磁性跟随效果
4. **半圆形范围** - 锚点只在节点外侧移动，不压入节点
5. **连接范围大** - 增大 `connectionRadius`，方便连接

---

## 三、方案设计

### 方案 A：分离锚点基础组件 + 可选菜单

#### 1. 基础锚点组件 `SimpleAnchors`

```typescript
interface SimpleAnchorsProps {
  nodeId: string;
  nodeType: string;
  // 可选：是否启用菜单
  enableMenu?: boolean;
}
```

**职责**：
- 渲染左右两侧锚点（使用 React Flow `Handle`）
- hover 显示/隐藏
- **不包含菜单功能**

#### 2. 锚点菜单组件 `AnchorMenu`（可选）

**职责**：
- 点击锚点时显示菜单
- 通过 React Portal 渲染
- 调用 `dispatchAnchorMenuPick` 处理选择

#### 3. 连接状态

| 状态 | 视觉表现 |
|------|----------|
| 默认 | 隐藏 |
| hover | 显示圆形边框锚点 |
| 连接中（合法） | 锚点 + 绿色半透明背景 |
| 连接中（非法） | 锚点 + 红色半透明背景 |

---

### 方案 B：轻量级锚点（推荐极简节点使用）

适用于 `MinimalImageNode` 这类不需要菜单的节点：

```tsx
// MinimalImageNode 中的锚点
<Handle
  type="target"
  position={Position.Left}
  id="input"
  className="minimal-anchor"
/>
```

**CSS 样式**：
```css
.minimal-anchor {
  /* 圆形边框锚点 */
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.35);
  border-radius: 50%;
  background: transparent;
}

/* + 符号 */
.minimal-anchor::before {
  content: "+";
  /* 居中定位 */
}

/* hover 显示 */
.react-flow__node:hover .minimal-anchor {
  opacity: 1;
}

/* 放大 */
.minimal-image-node:hover > .minimal-anchor {
  transform: scale(1.5);
}
```

---

## 四、磁性跟随实现方案

### 核心原理

React Flow 的 Handle 本身是固定位置的，要实现"锚点跟随鼠标"效果：

1. **视觉跟随** - 锚点（Handle）在视觉上跟随鼠标
2. **实际连接点不变** - React Flow 实际使用的连接位置仍然是 Handle 的原始位置
3. **通过 CSS transform** - 锚点视觉位置用 transform 偏移

### 实现步骤

```typescript
// 1. 监听连接状态
const connectionInProgress = useStore(s => s.connection.inProgress);

// 2. 监听鼠标移动
useEffect(() => {
  if (!connectionInProgress) return;

  const onMouseMove = (e: MouseEvent) => {
    // 计算锚点应该偏移的位置
    // 限制在半圆形范围内（以节点边缘为圆心）
    const offset = calculateOffset(e.clientX, e.clientY, anchorOrigin, maxRadius);
    setVisualOffset(offset);
  };

  window.addEventListener('mousemove', onMouseMove);
  return () => window.removeEventListener('mousemove', onMouseMove);
}, [connectionInProgress]);

// 3. 应用视觉偏移
<div style={{
  transform: `translate(${visualOffset.x}px, ${visualOffset.y}px)`
}}>
  <Handle ... />
</div>
```

### 半圆形范围计算

```typescript
function calculateOffset(
  mouseX: number, mouseY: number,
  anchorX: number, anchorY: number,
  maxRadius: number
) {
  const dx = mouseX - anchorX;
  const dy = mouseY - anchorY;

  // 左侧锚点：只允许向左（dx <= 0）
  // 右侧锚点：只允许向右（dx >= 0）
  const allowedDx = isLeftAnchor ? Math.min(dx, 0) : Math.max(dx, 0);

  const dist = Math.sqrt(allowedDx * allowedDx + dy * dy);

  if (dist > maxRadius) {
    // 限制在圆形范围内
    const scale = maxRadius / dist;
    return {
      x: allowedDx * scale,
      y: dy * scale
    };
  }

  return { x: allowedDx, y: dy };
}
```

---

## 五、文件结构

```
src/components/nodes/
├── anchors/
│   ├── SimpleAnchors.tsx      # 简单锚点（无菜单）
│   ├── AnchorMenu.tsx           # 锚点菜单（可选）
│   └── index.ts
├── MinimalImageNode.tsx         # 使用 SimpleAnchors
├── TextNode.tsx                 # 使用 AnchorMenu
└── ...
```

---

## 六、实施步骤

### Phase 1：基础锚点（SimpleAnchors）
1. 创建 `SimpleAnchors` 组件
2. 实现 hover 显示/隐藏
3. 实现圆形边框 + 符号样式
4. 在 `MinimalImageNode` 中使用

### Phase 2：磁性跟随
1. 添加连接状态监听
2. 实现 `mousemove` 跟随逻辑
3. 实现半圆形范围限制
4. 视觉偏移不影响实际连接

### Phase 3：菜单分离（可选）
1. 从 `MagneticNodeAnchors` 提取菜单逻辑
2. 创建 `AnchorMenu` 组件
3. 其他节点逐步迁移

---

## 七、关键决策

1. **是否需要菜单？**
   - 如果所有节点都需要菜单 → 保留 `MagneticNodeAnchors`
   - 如果只有部分节点需要 → 分离为 `SimpleAnchors` + `AnchorMenu`

2. **锚点样式统一还是分离？**
   - 统一 → 所有节点使用相同锚点样式
   - 分离 → 不同节点类型可以有不同的锚点样式

3. **磁性跟随是否必要？**
   - 如果需要流畅的连线体验 → 实现
   - 如果只是视觉提升 → 可以暂缓
