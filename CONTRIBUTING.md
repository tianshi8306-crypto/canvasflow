# Contributing Guide（低复杂度迭代）

本项目采用“小步快跑”模式。每轮迭代必须保持简单、可验证、可回退。

## 0. 方案分层约束（必须遵守）
- 所有需求必须映射到以下四层之一：
  - 创作体验层（画布、节点、交互一致性；**设计与体验**子维度见 [`docs/iterations/ROADMAP_V2.md`](docs/iterations/ROADMAP_V2.md) 与 [`docs/design/UI_ITERATION_GUIDE.md`](docs/design/UI_ITERATION_GUIDE.md)）
  - 生产链路层（脚本 -> 分镜 -> 视频 -> 导出）
  - 能力编排层（Provider、路由、容错、可观测）
  - 资产与质量层（资产沉淀、历史复用、质量门禁）
- 路线推进必须优先保持创作主链路连续，不允许只做“底层能力”而破坏可创作体验。
- 产品能力树与 LibTV 式画布体验的对照、防偏离约定见 [`docs/product/LIBTV_GUIDE_ALIGNMENT.md`](docs/product/LIBTV_GUIDE_ALIGNMENT.md)；大功能（如底部生成器、Slash 全家桶）须单独开轮或 Epic，避免静默扩散范围。

## 1. 单轮单目标
- 每轮只允许 1 个核心目标。
- 禁止在同一轮混入“顺手优化”与无关重构。

## 2. 范围上限
- 每轮最多 3 个模块。
- 每轮功能点控制在 2-4 项。
- 必须明确列出“本轮不做”。

## 3. 验收前置
- 每轮必须提供 3-5 步手工验收步骤。
- 验收步骤需要让非开发同学可执行。

## 4. 回退强制
- 每轮必须写清失败触发条件。
- 每轮必须写清回退动作与回退后保留信息（日志/截图/样本）。

## 5. 文档同步
- 功能、流程、入口变化后，必须同步更新：
  - `README.md`
  - 对应 `docs/iterations/iteration-xx-*.md`
  - 必要时更新 `RELEASE_CHECKLIST.md`

## 6. 最小质量门禁
- 合入前推荐 **`npm run release:check`**（`quality:gate` + 黄金路径 E2E 3 条）；最快仅门禁：`npm run quality:gate`。
- 发版或大改画布/工程/导出：另按 [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) **B 档** + [`docs/product/GOLDEN_PATH.md`](docs/product/GOLDEN_PATH.md) 手工验收。
- 无自动化测试时，必须补充可复现的手工验证说明。

## 7. 迭代文档规范
- 新一轮必须基于 `docs/iterations/ITERATION_TEMPLATE.md` 创建执行单。
- 迭代执行单文件命名：`iteration-xx-<topic>.md`。

## 8. 路线顺序约束（当前版本）
- R1 基础稳定
- R2 画布与五节点体验重构
- R3 脚本工作台 v1
- R4 分镜生成与批量操作 v1
- R5 视频生成与模型参数面板 v1
- R6 时间线合成与导出 v1
- R7 API 编排增强（Provider 路由/容错/费用可视化）
- R8 资产库、历史记录、模板复用
- R9 Agent 自动编排与稳定化发布

