# Windows Release Checklist

## 质量门禁（必须通过）

```bash
npm run quality:gate
```

该命令依次执行：

- TypeScript 类型检查
- ESLint 静态检查
- Vitest 单测 + 覆盖率阈值（`vitest run --coverage`）
- Rust 单测（`cargo test`）

完整门禁（含 Playwright E2E）：

```bash
npm run test:e2e:install
npm run quality:gate:full
```

## 手工验收步骤

- [ ] 工程打开/保存正常
- [ ] 工作流运行（至少一个 LLM 节点）
- [ ] 时间线渲染输出 `assets/exports/final.mp4`
- [ ] API Key 未写入工程文件（检查导出产物）
- [ ] 检查当前轮验收步骤（参考 `docs/iterations/iteration-xx-*.md`）
- [ ] 回退条件与产物已记录

## 文档对齐检查

- [ ] 当前迭代文档符合 `docs/iterations/ITERATION_TEMPLATE.md` 结构
- [ ] 路线图对齐 `docs/iterations/ROADMAP_V2.md`
- [ ] 四层架构映射已记录
- [ ] 创作主链路连通性检查：主题 -> 脚本 -> 分镜 -> 视频 -> 时间线 -> 导出
- [ ] 未违反分阶段路线图顺序（如 R7 前的 Provider 增强）
