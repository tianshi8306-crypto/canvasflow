# 迭代 16-E：分组态体验收尾

| 字段 | 值 |
|------|-----|
| 层 | CanvasExperienceLayer |
| 目标 | G9 组色标、G12 组级运行态、G13 水平/垂直排列 |
| 模块 | `GroupToolbar`、`GroupNode`、`canvasGroupColors` / `canvasGroupRunState` |

## Out of scope

- 嵌套组、组级 Hermes 新策略、云端主体库

## 验收

1. 分组工具条左侧 5 色块可切换/清除组框描边色
2. 宫格 / 横向 / 纵向 三种组内排列可用
3. 整组执行时组框显示「组内执行中」；失败/完成时描边与角标联动

## 回滚

还原 `GroupToolbar.tsx`、`GroupNode.tsx` 与新增 lib 文件即可。
