# CanvasFlow 画布快捷键

> 与 [`src/App.tsx`](../../src/App.tsx)、[`src/components/canvas/CanvasFlowChrome.tsx`](../../src/components/canvas/CanvasFlowChrome.tsx)、[`src/lib/canvasShortcutCatalog.ts`](../../src/lib/canvasShortcutCatalog.ts) 一致。  
> 画布左下角 **?** 打开四列说明浮层（对齐 LibTV 无限画布 §6.4 结构）。

## 创作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+G` / `⌘G` | 将选中节点打组 |
| `Ctrl+Alt+Shift+G` | 解组（打散 group 节点） |
| 拖出锚点 | 连线 |
| `Ctrl+Shift+C` | 复制整组（创建副本） |
| `Ctrl+Enter` | 生成：单选时跑子图，否则跑全图 |
| `Tab` | 在视口中心打开添加节点面板 |
| `Ctrl+Shift+G` | 单选文本/音频节点时打开模型对话或 TTS 面板 |
| `Ctrl+Shift+H` | 展开 / 收起内置 Hermes 智能体侧栏 |
| 拖入媒体 / 双击空白 | 导入或添加节点 |

## 缩放

| 快捷键 | 功能 |
|--------|------|
| `Ctrl++` / `Ctrl+=` | 放大 |
| `Ctrl+-` | 缩小 |
| `Ctrl+0` | 缩放 100% |
| `Z` | 适配画布上全部节点 |
| `F` | 聚焦当前选中节点 |
| 滚轮 | 在画布上缩放 |
| `Ctrl` + 滚轮 | 精确缩放（系统默认） |

## 移动画布

| 快捷键 | 功能 |
|--------|------|
| `Space` + 左键拖拽 | 平移画布 |
| `Alt` + 滚轮 | 画布整体上下平移 |
| `Shift` + 滚轮 | 画布整体左右平移 |
| 触控板双指 | 拖移平移 |
| 空白左拖 / `Shift` 点选 | 框选、多选 |
| 空白右键拖选 | 框选 |
| `Alt+Shift+F` | 整理画布 |
| `Alt+Shift+M` | 小地图开关 |
| `Alt+Shift+S` | 对齐吸附开关 |

## 其他

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` / `⌘Z` | 撤销 |
| `Ctrl+Shift+Z` / `⌘⇧Z` 或 `Ctrl+Y` | 重做 |
| `Delete` / `Backspace` | 删除选中 |
| `Ctrl+C` / `Ctrl+V` | 复制 / 粘贴 |
| `Ctrl+N` / `Ctrl+O` / `Ctrl+S` | 新建 / 打开 / 保存工程 |
| `?` | 打开 / 关闭快捷键说明 |
| 双击空白 | 打开添加面板 |
| 双击节点 | 节点居中 / 打开编辑 |

## 提示词（节点内）

| 键 | 功能 |
|----|------|
| `/` | Slash 预设 |
| `@` | 引用画布节点 |

## 说明

- Mac 上 `Ctrl` 可用 `⌘` 替代（见浮层展示）。
- 脚本全屏、设置等模态打开时，部分快捷键由输入焦点拦截。
