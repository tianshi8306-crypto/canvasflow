# 迭代 24 — Hermes 参考素材与创作阶段（Phase D 最小集）

**层**：CanvasExperienceLayer + ProductionFlowLayer  
**核心目标**：侧栏钉选工程 `assets/` 参考图，对话内 **@素材名** 引用（非 @ 画布节点），出图时注入图生图参考路径；显示五阶段中的当前阶段标签。

## 功能点

1. **参考素材条**：导入图片进工程并钉选到 Hermes 会话（`localStorage` 按 `projectPath`）
2. **@素材**：输入框与缩略图点击插入 `@名称`；Director 解析后写入计划与 `batchGenerateImages` 的 `referenceImagePathsPrefix`
3. **创作阶段**：根据脚本/分镜/成片节点推断「创意碰撞 / 大纲 / 视觉化 / 调整 / 成片」
4. 纯聊天时仍将已 @ 素材路径附录给 Brain（`formatRefsForLlm`）

## 模块

- `src/lib/hermes/hermesRefAssets.ts`
- `src/lib/hermes/hermesCreativeStage.ts`
- `src/components/hermes/HermesRefAssetsStrip.tsx`
- `HermesSidebar.tsx` + `hermes-shell.css`

## 非目标

- 后台任务总进度条、计划模板库
- 视频 Seedance `@图1` 自动写入（仍由视频节点 UI 负责）
- 拖放直传侧栏（仅「+ 添加」文件对话框）

## 手工验收

1. 打开工程 → Hermes「+ 添加」参考图 → 输入 `@名称 帮分镜出图` → 计划含「参考 N 个素材」→ 执行后图片任务带参考路径
2. 点缩略图 → 输入框插入 `@名称`
3. 无工程时素材条提示先打开工程
4. 阶段标签随脚本/分镜/出图进度变化

## 回滚

- 移除 `HermesRefAssetsStrip` 与 `referenceImagePathsPrefix` 参数，Director 仍可用
