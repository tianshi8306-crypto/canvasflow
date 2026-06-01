# 迭代 21 — Hermes Shell 空壳（Phase A）

**层**：CanvasExperienceLayer  
**核心目标**：主窗口内嵌 Hermes 侧栏 + Idle 灵体，展开/收起与位置持久化；**零 LLM、零端口**。

## 功能点

1. `HermesShell` 接入 `App`：`mainSplit` 右侧栏 + Portal 灵体  
2. `canvasUiStore`：`mode`（expanded | idle）、`panelWidth`、`orbDock` + localStorage  
3. 侧栏：问候、快捷技能占位、本地 echo 对话、输入框  
4. 灵体：可拖拽、点击展开；呼吸动效  

## 模块

| 模块 | 文件 |
|------|------|
| 状态 | `src/lib/hermes/hermesShellPrefs.ts`、`canvasUiStore` |
| UI | `src/components/hermes/*`、`src/styles/hermes-shell.css` |
| 壳层 | `src/App.tsx` |

## 非目标

- Rust `hermes_agent`、流式 Chat、@ 引用  
- 自动调 Chain / nodeAgentRuntime  
- 侧栏可换左右（固定右侧）  

## UI/UX

- **界面**：画布右侧 `360px` 侧栏（`--cf-charcoal-elevated`）；Idle 右下角灵体（青绿光晕）  
- **状态**：展开 / 收起；输入为空禁用发送；技能点击仅写入占位回复  
- **键盘**：侧栏 `textarea` 内不触发画布快捷键；`Ctrl+Shift+H` 切换展开/收起  
- **非目标**：不改顶栏 Tab、不改节点 chrome  

## 手工验收

1. 启动应用 → 右下角见 Hermes 灵体，画布全宽  
2. 点击灵体 → 右侧栏展开，灵体隐藏  
3. 侧栏输入并发送 → 对话区 echo，无网络请求  
4. 收起 → 灵体再现；拖拽灵体后刷新，位置大致保留  
5. 侧栏输入框聚焦时按 `Ctrl+Z` 不触发画布撤销  

## 回滚

- 移除 `HermesShell` 与 store 字段；`mainSplit` 恢复单画布  

## 参考

- [`docs/product/HERMES.md`](../product/HERMES.md)
