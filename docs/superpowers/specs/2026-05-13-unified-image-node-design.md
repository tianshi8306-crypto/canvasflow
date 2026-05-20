# 统一图片节点设计方案

## 概述

统一图片节点设计，以 `MinimalImageNode` 为外壳，整合 `ImageAssetNode` 的完整功能，形成一个简洁而功能完备的图片节点。

### 现状分析

项目中存在三种图片相关组件：
- **ImageAssetNode** (`src/components/nodes/ImageAssetNode.tsx`) - 旧版完整节点，使用 NodeFrame + MagneticNodeAnchors
- **MinimalImageNode** (`src/components/nodes/MinimalImageNode.tsx`) - 实验性极简节点，使用 SimpleAnchors
- **ImageGenerationPanel** (`src/components/nodes/ImageGenerationPanel.tsx`) - 生成面板，供以上两种节点共用

### 设计目标

1. **统一节点类型**: 以 `MinimalImageNode` 为基础，整合 `ImageAssetNode` 功能
2. **保留完整功能**: 上传图片、图生图参考、文生图生成
3. **保持简洁外观**: 极简预览区 + 标签 + 分辨率
4. **独立生成面板**: 使用 `floatingBottomOverlay`，不改变节点高度

---

## 设计方案

### 节点外观

```
┌─────────────────────────────┐
│ 标签                  1920×1080│  ← 左上：可编辑标签；右上：分辨率
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │      [图片预览]         │ │  ← 点击上传，hover 显示操作提示
│ │                         │ │
│ └─────────────────────────┘ │
│       ◯────────○            │  ← SimpleAnchors 锚点
└─────────────────────────────┘
```

**尺寸规格**:
- 宽度: 280px (narrow)
- 高度: 180px (固定)
- 圆角: 10px
- 预览区: 填满除锚点外的区域

### 生成面板 (floatingBottomOverlay)

当选中节点时，在节点下方显示独立浮层：

```
┌─────────────────────────────┐
│ 标签                  1920×1080│
│ ┌─────────────────────────┐ │
│ │      [图片预览]         │ │
│ └─────────────────────────┘ │
│       ◯────────○            │
└─────────────────────────────┘
  ┌───────────────────────────────────┐
  │ 参考图  主体  模型  [文生图▼]      │  ← floatingBottomPanel
  │ ┌─────────────────────────────┐   │
  │ │ prompt textarea             │   │
  │ └─────────────────────────────┘   │
  │                      [↑生成]     │
  └───────────────────────────────────┘
```

### 交互设计

| 交互 | 行为 |
|------|------|
| 点击预览区 | 触发系统文件选择器上传图片 |
| hover 预览区 | 显示"点击上传"提示遮罩 |
| 点击标签 | 进入标签编辑模式 |
| 双击标签 | 进入标签编辑模式 |
| 点击分辨率 | 无操作（静态显示） |
| 选中节点 | 显示 `floatingBottomOverlay` 生成面板 |

### 锚点设计

保留 `SimpleAnchors`，支持：
- **左侧锚点**: 接收图片/文本输入（图生图参考）
- **右侧锚点**: 输出到文本/图片/视频节点

---

## 架构设计

### 组件结构

```
src/components/nodes/
├── UnifiedImageNode.tsx       # 新建：统一图片节点
├── ImageGenerationPanel.tsx    # 保留：生成面板
└── anchors/
    └── SimpleAnchors.tsx      # 保留：简单锚点
```

### UnifiedImageNode 实现

```typescript
interface UnifiedImageNodeProps {
  id: string;
  data: FlowNodeData;
}

export function UnifiedImageNode({ id, data }: UnifiedImageNodeProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const selected = /* 通过 useNodeSelection 或类似 hook 获取 */;

  const hasPath = Boolean(data.path?.trim() || data.assetId?.trim());
  const src = resolveSrc(projectPath, data.path);
  const imgSize = /* 从图片加载获取 */;

  // 复用 ImageGenerationPanel
  const floatingPanel = selected ? (
    <div className="nodeFloatingBottomPanel">
      <ImageGenerationPanel
        nodeId={id}
        referenceImagePath={/* 从上游连接获取 */}
        referenceImageAssetId={/* 从上游连接获取 */}
      />
    </div>
  ) : null;

  return (
    <>
      {/* 标签 */}
      <div className="minimal-image-label">...</div>

      {/* 分辨率 */}
      {imgSize && <div className="minimal-image-res">...</div>}

      {/* 节点主体 */}
      <div className="minimal-image-node">
        <div className="minimal-image-preview" onClick={handleUpload}>
          {hasPath ? (
            <img src={src} onLoad={handleImgLoad} />
          ) : (
            <Placeholder />
          )}
        </div>
        <SimpleAnchors nodeId={id} nodeType="imageNode" />
      </div>

      {/* 独立生成面板 - 通过 createPortal 渲染到 body */}
      {floatingPanel}
    </>
  );
}
```

### 数据流

```
用户点击预览区
    ↓
pickImagePathsForImport() 获取文件路径
    ↓
assignImportedMediaToNode(nodeId, paths) 分配给节点
    ↓
updateNodeData(nodeId, { path, assetId })
    ↓
UI 自动更新（Zustand 响应式）
```

### 上游参考图获取

复用现有 `getIncomingImageRefForNode` 逻辑：

```typescript
const incomingRef = useMemo(
  () => getIncomingImageRefForNode(nodes, edges, id),
  [nodes, edges, id],
);
```

---

## 迁移计划

### Step 1: 创建 UnifiedImageNode

1. 在 `src/components/nodes/` 创建 `UnifiedImageNode.tsx`
2. 整合 MinimalImageNode 的外观 + ImageAssetNode 的上传逻辑 + ImageGenerationPanel
3. 使用 `SimpleAnchors` 作为锚点
4. 实现 `floatingBottomOverlay` 模式的生成面板

### Step 2: 更新 nodeTypes 注册

在 `FlowCanvas.tsx` 中：

```typescript
import { UnifiedImageNode } from "@/components/nodes/UnifiedImageNode";

// 替换 nodeTypes 注册
imageNode: UnifiedImageNode,
```

### Step 3: 删除冗余组件

- 删除 `ImageAssetNode.tsx`（如不再使用）
- 保留 `ImageGenerationPanel.tsx`（仍被其他节点使用）
- 保留 `SimpleAnchors.tsx`（锚点基础设施）

### Step 4: 更新样式

在 `global.css` 中确认/添加：

```css
.unified-image-node {
  width: 280px;
  height: 180px;
  border-radius: 10px;
  /* ... */
}
```

---

## 向后兼容

- 现有 canvas JSON 中的 `imageNode` 类型节点继续正常工作
- `imageAsset` 类型节点仍可保留用于素材库场景（如需要）
- 节点数据 `{ path, assetId, prompt, params }` 结构不变

---

## 验收标准

1. ✅ 新建图片节点显示为极简风格（预览区 + 标签 + 分辨率）
2. ✅ 点击预览区可上传本地图片
3. ✅ 上传后图片正确显示，分辨率自动更新
4. ✅ 选中节点时，生成面板在节点下方独立浮出
5. ✅ 生成面板可正常进行文生图/图生图操作
6. ✅ 锚点连接功能正常
7. ✅ 标签可编辑
8. ✅ 节点高度固定，不因生成面板而变化
