# 迭代 13-4B：Hermes 触发策略产品化

**层**：ProductionFlowLayer + ProviderOrchestrationLayer  
**核心目标**：明确「何时自动建链」——分镜文案完成后、可配置开关与范围，非脚本解析完成时盲目 spawn。

## 功能点

1. **全局设置**（设置 → 系统，localStorage）：开关 + 范围（仅勾选就绪 / 全部就绪）  
2. **节点覆盖**（Inspector）：跟随全局 / 本节点关闭 / 本节点开启  
3. **触发时机**：`分镜生成 Agent` 的 `end` 事件（移除「脚本调度 Agent」触发）  
4. **就绪判定**：`storyboardShots` 中 `status=generated` 且 `visualPrompt` 非空  
5. **分镜区提示**：建链范围 + Hermes 策略一行说明；手动按钮改名为「Hermes 手动串联」

## 模块

| 模块 | 文件 |
|------|------|
| 策略 | `src/lib/hermes/hermesAutoChainPolicy.ts` |
| 监听 | `src/lib/hermes/autoChain.ts` |
| UI | `SettingsPanel`、`ScriptHermesAutoChainControl`、`ScriptStoryboardSection` |

## 非目标

- 无人值守自动跑完全片  
- 脚本解析完成即建链（已移除）

## 手动验收

1. 设置关闭 Hermes → 生成分镜文案 → **不**自动出现 image/video 节点  
2. 设置开启 + 勾选 2 镜 + 仅勾选范围 → 分镜完成 → 仅 2 组节点  
3. 节点设为「本节点关闭」→ 即使全局开启也不自动建链  
4. 无勾选 +「仅勾选」范围 → 状态栏提示未勾选，不建链  
5. 「Hermes 手动串联」按钮仍可随时手动触发

## 回滚

- 恢复 `脚本调度 Agent` 监听；删除 `hermesAutoChainPolicy.ts` 与设置项
