# 节点 UI 设计规范

## 文档索引

| 文档 | 版本 | 说明 |
|------|------|------|
| **[canvas-node-chrome-spec.md](./canvas-node-chrome-spec.md)** | **1.3** | **LibTV 极简节点 Chrome 体系**（图片/视频已接入，迁移音频等必读） |
| 下文 React Flow 通用约定 | 3.0 | Handle、暗色、CSS 变量等底层约定 |

> 做节点 UI 迁移时：**先读 Chrome Spec**，再对照本文的 React Flow 基础项。

---

## React Flow 通用约定 v3.0

## 参考来源- React Flow 官方文档和讨论
- xyflow/xyflow GitHub 仓库
- 主流节点编辑器设计模式

---

## 1. React Flow 节点结构

React Flow 节点的 DOM 结构：
```html
<div class="react-flow__node">  <!-- node.style 应用于此 wrapper -->
  <div>                      <!-- 你的自定义节点内容 -->
    <Handle />
    <p>{data.label}</p>
  </div>
</div>
```

**重要**：`node.style` 应用于外层 wrapper，不是自定义节点本身。

---

## 2. React Flow CSS 变量（官方推荐）

```css
/* 节点样式变量 */
--xy-node-background-color-default: #fff;
--xy-node-border-default: 1px solid #1a192b;
--xy-node-color-default: inherit;

/* 边样式变量 */
--xy-edge-stroke-default: #b1b1b1;
--xy-edge-stroke-selected: #6366f1;

/* Handle 样式变量 */
--xy-handle-background-color-default: #eeeeee;
--xy-handle-border-color-default: #1a192b;
```

---

## 3. 推荐实现方式

### 3.1 使用 colorMode="dark"
```jsx
<ReactFlow colorMode="dark" nodes={nodes} edges={edges} />
```

### 3.2 使用 base.css 避免样式冲突
```js
import '@xyflow/react/dist/base.css';
```

### 3.3 节点 CSS 样式
```css
/* 基础节点 */
.react-flow__node {
  background: #1e1e24;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0;
  min-width: 200px;
}

/* 选中状态 */
.react-flow__node.selected {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
}

/* Handle 默认隐藏 */
.react-flow__handle {
  opacity: 0;
  width: 8px;
  height: 8px;
  background: rgba(255, 255, 255, 0.5);
  border: none;
}

/* hover 时显示 */
.react-flow__node:hover .react-flow__handle {
  opacity: 1;
}

/* 连接中全局显示 */
.react-flow--connecting .react-flow__handle,
.react-flow--drag-connecting .react-flow__handle {
  opacity: 1;
}
```

---

## 4. 节点设计原则

### 4.1 简洁节点
- 节点仅负责渲染，不管理业务逻辑
- 使用 CSS 类进行样式化，避免 inline style
- 节点内容使用 flexbox 布局

### 4.2 Handle 设计
- 默认隐藏，hover 时显示
- 尺寸：8-10px
- 圆形或矩形
- 位置在节点边缘

### 4.3 统一圆角
- 推荐 8px 圆角
- 避免过大的圆角（显得笨重）

---

## 5. 完整 CSS 变量参考

```css
:root {
  /* 节点 */
  --xy-node-background-color-default: #1e1e24;
  --xy-node-border-default: 1px solid rgba(255, 255, 255, 0.1);
  --xy-node-border-radius: 8px;
  --xy-node-padding: 0;

  /* 边 */
  --xy-edge-stroke: #555;
  --xy-edge-stroke-width: 2;
  --xy-edge-stroke-selected: #6366f1;

  /* Handle */
  --xy-handle-background-color-default: rgba(255, 255, 255, 0.5);
  --xy-handle-border-color-default: transparent;
  --xy-handle-border-width: 0;

  /* MiniMap */
  --xy-minimap-background-color: #1a1a1a;

  /* Controls */
  --xy-controls-button-background-color: #1a1a1a;
  --xy-controls-button-background-color-hover: #2a2a2a;
  --xy-controls-button-border-color: rgba(255, 255, 255, 0.1);
  --xy-controls-button-icon-color: #fff;
}
```

---

## 6. 开发检查清单

- [ ] 使用 `colorMode="dark"` 启用暗色模式
- [ ] 导入 `base.css` 或 `style.css`
- [ ] Handle 默认隐藏，hover 显示
- [ ] 节点使用 CSS 类样式
- [ ] 统一圆角 8px
- [ ] 节点边框使用 `rgba(255, 255, 255, 0.1)`

---

*文档版本：3.0*
*更新日期：2026-05-12*
*参考：React Flow 官方文档、GitHub Discussions*