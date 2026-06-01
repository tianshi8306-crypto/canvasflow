# 迭代 20 — 设置「模型」页信息架构

> 层：**CanvasExperienceLayer**  
> 更新：**2026-05-21**  
> 状态：**已完成**

## 1) 目标

新用户能分清：文本/脚本/LLM、图片、视频、音频各自在哪配置；消除 Provider 双列表重复。

## 2) 变更

| 项 | 说明 |
|----|------|
| 20-1 | `SettingsModelsPane` + 子 Tab（总览 / 文本与脚本 / 图片 / 视频 / 语音） |
| 20-2 | 总览四卡：节点类型 → 配置入口 + 就绪状态 |
| 20-3 | `SettingsChatProvidersSection` 合并原 API 区 + 文本模型区（仅 `chat` 能力 Provider） |
| 20-4 | `ProviderCard` `chatMode`：启用 / 模型 ID / 优先级 |
| 20-5 | 即梦 OAuth 在「总览」`SettingsDreaminaOverviewCard`（图片·视频共用） |
| 20-6 | 默认条数：文本 1 / 图 2 / 视 2 / 音 1；仅显示已配置对话服务商；保留「添加」 |

## 3) 非目标

- 不合并 `imageModels` 与 `providers` 存储结构  
- 不改节点内模型下拉实现

## 4) 验收

1. 设置 → 模型 → 总览：四卡可点击跳转对应 Tab。  
2. 「文本与脚本」仅见 OpenAI / GRSAI 等对话类服务商；同一处填 Key + Model ID。  
3. 图片 / 视频 / 语音 Tab 标题与节点徽章明确。  
4. 即梦登录在图片 Tab 底部。  
5. `npm run typecheck` 通过。

## 5) 入口

- `src/components/settings/SettingsModelsPane.tsx`
- `src/components/SettingsChatProvidersSection.tsx`
- `src/lib/settingsModelsOverview.ts`
