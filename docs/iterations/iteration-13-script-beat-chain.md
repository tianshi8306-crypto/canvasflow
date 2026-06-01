# 迭代 13-4A：勾选驱动的批量建链

**层**：ProductionFlowLayer + CanvasExperienceLayer  
**核心目标**：分镜区一键只为勾选镜头创建 image/video（及可选 audio），并写入 `params.scriptBeatId`。

## 功能点

1. **`buildScriptBeatChain`**：与 `resolveStoryboardBeatScope` 一致（有勾选→仅勾选；无勾选→全部）
2. **跳过已建链**：同 `scriptBeatId` 已有下游节点时不重复创建
3. **图+视频配对**：`脚本→图→视频` 横向布局；`一键建链（图+视频）` + 分项「仅图片/仅视频/仅音频」
4. **Hermes 串联**：尊重勾选范围；已存在图+视频的镜头跳过

## 模块

| 模块 | 文件 |
|------|------|
| 建链核心 | `src/lib/scriptBeatChainBuild.ts` |
| 范围提示 | `scriptStoryboardScope.storyboardChainScopeHint` |
| UI | `ScriptStoryboardSection.tsx` |
| Hermes | `src/lib/hermes/autoChain.ts` |

## 非目标

- 新节点类型
- Hermes 全自动策略开关（4-B）

## 手动验收

1. 10 镜勾选 2 镜 →「一键建链」→ 仅 2 对 image/video，`params.scriptBeatId` 正确  
2. 再次点击 → 状态栏提示跳过已存在  
3. 粘贴脚本子图 → `pasteScriptBeatRemap` 仍重写下游 `scriptBeatId`（既有测试）  
4. 无勾选 → 建链作用于全部镜头（与分镜文案规则一致）

## 回滚

- 恢复 `ScriptStoryboardSection` 内联建链函数；删除 `scriptBeatChainBuild.ts`
