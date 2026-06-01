# Iteration 42-2 — 对话管理参考素材 ✅

- **层**：ProductionFlowLayer
- **前置**：iter-42-1
- **目标**：无参考素材条 UI；通过对话钉选/列出/移除工程 `assets/` 参考，并与 `@`、出图 `referenceRelPaths` 打通。

## 交付

| 用户说法（示例） | 行为 |
|------------------|------|
| 列出参考素材 / 参考列表 | 对话返回当前钉选列表 |
| 把「霓虹」加为参考 / 最新图加为参考 | 从 `list_assets` 匹配并 `pin` |
| 去掉参考 @霓虹 / 移除参考「xxx」 | `unpin` |
| 清空参考 | 清空钉选 |
| 导入参考图片 | 文件选择 → `import_media_files` → 自动 pin |

## 模块

- `hermesRefAssetsChat.ts` · `hermesRefAssets.ts`（unpinByMention / clear / formatChat）
- `HermesSidebar.tsx` 意图分流（在模板/教学之前）

## 验收

1. 工程内有图 →「把最新导入的图加为参考」→ 对话确认 @名 → 说「分镜出图 @xxx」→ 计划带 referenceRelPaths。
2. 「列出参考素材」→ 仅对话列表，无侧栏条。
3. `npm run typecheck` + `hermesRefAssetsChat.test.ts` 通过。

## 回滚

删除 `hermesRefAssetsChat` 与 Sidebar 分流分支。
