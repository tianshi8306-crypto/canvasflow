---
id: creative-script-beats
category: creative
tags: [脚本, 镜头表, scriptBeats, 场次]
---

# 脚本镜头表（scriptBeats）字段指南

> **数据真源**：`scriptNode.data.scriptBeats`；解析 Agent / 工作台编辑。

## 核心字段

| 字段 | 用途 |
|------|------|
| shotNumber | 镜号（展示用，如 1、1A） |
| scene | 场次/场景名 |
| description | **画面+动作**叙述（给分镜 Agent 的主输入） |
| dialogue | 对白（不直接进入视频 prompt） |
| characters | 出场角色名（与项目圣经角色库对齐） |
| durationSec | 预估时长（规划用，非 Seedance 硬限制） |

## 写好 description 的要点

- 用**现在时、可视动作**（「女主推门进入」而非「将会进入」）  
- 一场戏多镜：每场 2～5 镜为宜，避免一镜塞满剧情  
- 角色首次出场写清外貌锚点（服装、发型），便于后续出图一致

## 与上游关系

- **textNode / 梗概** → 脚本解析 → scriptBeats  
- **剧本上传**（docx/txt）→ 漏洞报告 → 导入后再「AI 解析镜头」

## Hermes 常用指令映射

- 「写大纲/镜头表」→ `script.generate_outline`  
- 「生成分镜文案」→ `script.generate_storyboard`（需已有 beats）  
- 「第 N 镜」→ 计划 args `beatIds: [N]`
