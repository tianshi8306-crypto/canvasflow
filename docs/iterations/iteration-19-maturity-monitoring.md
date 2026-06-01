# 迭代 19 — 成熟度监控（黄金路径 + 关键单测）

> 层：**AssetAndQualityLayer**  
> 更新：**2026-05-21**  
> 状态：**已完成**

## 1) 本轮目标

单人开发可重复验证主链路未静默损坏：文档化手工黄金路径 + 浏览器 E2E 冒烟 + 关键路径 Vitest。

## 2) 变更范围

- `docs/product/GOLDEN_PATH.md`
- `e2e/golden-path.spec.ts`、`e2e/smoke.spec.ts`（保留）
- `src/lib/canvasTabSync.test.ts`、`src/lib/compose/buildFromScript.test.ts`、`src/store/projectStore.goldenPath.test.ts`
- `src/store/projectStore.ts`（`afterGraphEdit` 首节点补 Tab）

## 3) 功能清单

| 项 | 说明 |
|----|------|
| M19-1 | 10 步手工黄金路径文档 |
| M19-2 | Playwright 冒烟 3 条（浏览器模式）；iter-95 增至 **4 条**（步骤 1 桌面壳提示） |
| M19-3 | Tab / 合成导出关键单测 |
| M19-4 | `npm run test:e2e:golden` 快捷脚本 |
| M19-5 | **发布前清单三档**（`RELEASE_CHECKLIST.md` A/B/C）+ `release:check` / `release:check:full` |
| M19-6 | PR 模板对齐 `release:check`；Tab 切换 `canvasTabSync` 单测 |

## 4) 非目标

- Tauri 桌面 E2E、FFmpeg 真导出自动化
- 资产纵轴 M5、Inspector 挂壳、新 Provider

## 5) 验收步骤

1. `npm run test:e2e:golden` 全绿（**4 条**，含 iter-95 步骤 1）  
2. `npm run test -- src/store/projectStore.goldenPath.test.ts src/lib/canvasTabSync.test.ts src/lib/compose/buildFromScript.test.ts` 全绿  
3. 浏览器按 `GOLDEN_PATH.md` 步骤 1～3、7 可走通  
4. `CURRENT_PROGRESS.md` / `RELEASE_CHECKLIST.md` 已链到黄金路径  
5. `npm run release:check` 在干净环境可跑通（需已 `test:e2e:install`）  
6. Tab 切换单测：`canvasTabSync.test.ts` → `tab switch workflow`  

## 6) UI/UX

本轮无 UI 变更（仅 Tab 未保存同步修复）。

## 7) 风险与回退

- **风险**：E2E 依赖 Vite 1420 冷启动慢  
- **触发**：`golden-path` 或关键单测失败  
- **回退**：还原 `projectStore.afterGraphEdit`、`e2e/golden-path.spec.ts` 与本迭代单测文件  

## 8) 入口索引

| 类型 | 路径 |
|------|------|
| 手工 | `docs/product/GOLDEN_PATH.md` |
| E2E | `e2e/golden-path.spec.ts` |
| 单测 | `projectStore.goldenPath.test.ts`、`canvasTabSync.test.ts`、`buildFromScript.test.ts` |
