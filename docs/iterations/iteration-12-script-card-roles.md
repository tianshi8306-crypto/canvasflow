# 迭代 12-3B：角色与卡片视图

**层**：CanvasExperienceLayer + ProductionFlowLayer  
**核心目标**：`characters[]` 与卡片视图达到表格同级可编辑性，角色图列与卡片联动。

## 功能点

1. **角色摘要**：`ScriptBeatRoleSummary`（头像条 + 文案）用于卡片折叠态与全屏表「角色」列按钮  
2. **共享编辑**：`ScriptBeatRolesEditor` ← 表格 `ScriptRolePopoverEditor` 与卡片「编辑角色」  
3. **Legacy 同步**：`applyCharactersToBeat` / `patchRowCharacters` 写回 `character1Image` 等列  
4. **卡片流分镜**：`ScriptWorkbenchCardToolbar` — 生成分镜 / 进入分镜区（勾选范围与 09-0A 一致）

## 模块

| 模块 | 文件 |
|------|------|
| 数据同步 | `scriptBeatsTableModel.ts`（`applyCharactersToBeat`、`getBeatRoles`） |
| UI | `ScriptBeatRolesEditor`、`ScriptBeatRoleSummary`、`ScriptWorkbenchCardView` |
| 工具栏 | `ScriptWorkbenchCardToolbar`、`ScriptNodeWorkbench` |

## 非目标

- 全局角色库实体（Epic E4）

## 手动验收

1. 卡片视图「编辑角色」上传参考图 → 切表格全屏 → 同镜「角色图」列有预览  
2. 表格 Popover 改角色名 → 卡片摘要文案更新  
3. 卡片流：添加镜头、删镜头、改角色、勾选后「生成分镜」仅处理勾选  
4. 「进入分镜区」滚动到 Inspector 分镜区  

## 回滚

- 恢复 `patchRowCharacters` 仅写 `characters`；卡片内联大表单
