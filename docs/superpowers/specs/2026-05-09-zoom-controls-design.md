# 画布缩放控制组件设计方案

## 背景

CanvasFlow AI Studio 使用 React Flow 作为画布引擎。当前画布缩放通过鼠标滚轮和 React Flow 内置 Controls 组件实现，但缺少统一的 UI 控制入口。本设计为画布提供显式的缩放控制栏。

## 设计目标

- 替换/增强画布右下角缩放入口
- 支持快速缩放（+ / -）
- 支持预设快捷缩放（50% / 100% / 200% / 适合屏幕）
- 与现有 React Flow 视口管理无缝集成

## 组件规格

### 外观布局

```
[ - ]  [ 75% ]  [ + ]
```

- 横向排列的三个按钮组
- `-` 和 `+` 为等宽图标按钮
- 中间为百分比文字按钮（带下拉箭头），点击弹出二级菜单
- 背景：半透明深色毛玻璃（`background: rgba(22,26,34,0.85); backdrop-filter: blur(8px)`）
- 圆角：8px
- 位于 MiniMap 上方（bottom: 80px, right: 10px）

### 交互行为

#### `-` / `+` 按钮
| 行为 | 结果 |
|------|------|
| 点击 | 缩放步进 ±10%（zoom → zoom × 1.1 或 ÷ 1.1） |
| 长按（>500ms） | 进入连续缩放模式，每 150ms 执行一次 |
| 点击到极限值（0.15 / 3.0） | 按钮短暂闪烁提示（已是极限） |

#### 中间百分比按钮
| 行为 | 结果 |
|------|------|
| 点击 | 展开二级菜单 |
| 再次点击 / 点击外部 | 关闭菜单 |

#### 二级菜单

| 选项 | 行为 |
|------|------|
| 放大 | 同 `-` / `+` 中的 `+` |
| 缩小 | 同 `-` / `+` 中的 `-` |
| 适合屏幕 | 计算所有节点边界，缩放居中显示 |
| 缩放至 50% | 设置 zoom = 0.5 |
| 缩放至 100% | 设置 zoom = 1.0 |
| 缩放至 200% | 设置 zoom = 2.0 |

#### 适合屏幕算法
```
1. 获取所有节点 bounds（position + width/height）
2. 计算合并边界（left, top, right, bottom）
3. 添加 padding（80px）
4. 计算 scale 使边界完全落入可视窗口
5. 居中视口
6. 钳制 zoom 至 [0.15, 3.0]
```

## 技术实现

### 新增文件
- `src/components/canvas/ZoomControls.tsx`

### 依赖
- `useReactFlow` 的 `setViewport`、`getViewport`
- React Flow Panel 定位

### 缩放范围
- `minZoom = 0.15`（已有）
- `maxZoom = 3.0`（已有）

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/components/canvas/ZoomControls.tsx` | 新建 |
| `src/components/FlowCanvas.tsx` | 引入 ZoomControls 并移除 React Flow 内置 Controls |