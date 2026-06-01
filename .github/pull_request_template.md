## 摘要



<!-- 简述本 PR 的目的与范围 -->



## 变更类型



- [ ] 功能

- [ ] 修复

- [ ] 重构 / 工程

- [ ] 文档



## 自检清单



### 自动化（默认）



- [ ] 已运行 **`npm run release:check`**（= `quality:gate` + 黄金路径 E2E 3 条）

- [ ] 或等价：已运行 `npm run quality:gate`，且改动了画布 Tab / 合成 / 脚本导出时已跑 `npm run test:e2e:golden`



### 按变更类型追加



- [ ] **画布 / Tab / 工程保存**：浏览器或 Tauri 中验证 Tab 切换不串图（见 [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md) B 档「Tab 切换快验」）

- [ ] **脚本 / 分镜 / 视频 / 导出**：已对照 [`docs/product/GOLDEN_PATH.md`](../docs/product/GOLDEN_PATH.md) 相关步骤（桌面项需 `npm run tauri dev`）

- [ ] **发版或大改**：已执行 [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md) **B 档**手工项



### 与 CI 完全一致（可选）



- [ ] 已运行 `npm run test:e2e:install` 后 **`npm run release:check:full`**



## 相关 issue / 讨论



<!-- 可填 issue 编号或留空 -->

