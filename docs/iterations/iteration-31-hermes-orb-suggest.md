# 迭代 31 — Orb 主动建议

**层**：CanvasExperienceLayer  
**核心目标**：侧栏收起时，灵体根据制片状态变化与任务失败弹出可操作建议；一键展开 Hermes 并预填话术。

## 模块

1. `src/lib/hermes/hermesOrbSuggestions.ts` — 建议策略与状态跃迁检测  
2. `src/store/hermesOrbSuggestStore.ts` + `HermesOrbSuggestionBridge`  
3. `HermesOrb` + `HermesOrbSuggestionPopover` + `expandHermesWithPrompt`

## 功能点

1. **失败优先**：后台 Agent 失败、分镜失败、视频失败 → 角标 + 气泡  
2. **跃迁提示**：分镜刚全部就绪 →「建链并出图」；关键帧刚齐 →「批量出视频」  
3. **稳态提示**：缺关键帧、多镜可批量视频（首次指纹变化时）  
4. 「稍后」写入 session 按工程 dismiss，同 id 本会话不再弹

## 非目标

- 自动执行计划（仍须用户在侧栏确认）  
- 建议持久化进工程文件  
- 顶栏全局通知中心

## 手工验收

1. 生成全部分镜文案（从未完成→完成）→ 收起侧栏 → 灵体左侧出现「分镜已全部就绪…」→ 点「建链并出图」→ 侧栏打开且输入框已填话术  
2. 故意让 1 个图片 Agent 失败 → 气泡提示失败重试  
3. 点「稍后」→ 同建议不再出现（本会话）  
4. 切换/关闭工程 → 建议清空

## 回滚

- 移除 Bridge / Popover / suggest store，恢复 iter-30 仅任务角标
