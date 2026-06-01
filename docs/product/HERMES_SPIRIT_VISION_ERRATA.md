# HERMES_SPIRIT_VISION 勘误表（Octo 对标 · 实现对照）

> **对照文档**：[HERMES_SPIRIT_VISION.md](./HERMES_SPIRIT_VISION.md)  
> **快照日期**：2026-05-29（代码与迭代约至 iter-105）  
> **用途**：母文档写于 iter-25 前后，后续 iter-26～105 已交付大量能力；**以本表 + 代码为准**，勿将 §1/§2/§8 当作现网真相。  
> **Octo 公开信息**：仍为非官方归纳；内测 UI 可能与介绍页不一致。

---

## 1. 如何使用

| 符号 | 含义 |
|------|------|
| ✅ 已实现 | 主路径可用，见迭代/代码 |
| ⚠️ 部分 | 后端或规则有，UI/体验未达 Octo 或文档描述 |
| ❌ 仍缺 | 与 Octo/vision 目标差距仍大 |
| 📄 文档滞后 | vision 表述过时，实现已超前 |
| 🎯 仍有效 | 产品方向未变，仅「今天」列需更新 |

---

## 2. 按章节勘误（HERMES_SPIRIT_VISION.md）

### §0 结论先行

| 原表述 | 勘误 | 依据 |
|--------|------|------|
| 「今天：计划靠关键词匹配」 | 📄→⚠️ **规则 + LLM 混合**（`hermes_plan` / `hermesPlanLlm` + `hermesPlanFromIntent` 兜底） | iter-28+ |
| 「几乎不碰视频 Agent」 | 📄→✅ Director 含 `video.generate_for_beats`、`video.retry_failed` | iter-26+ |
| 「确认后调现有 Agent」 | 📄→⚠️ 默认 **`agentAutoExecute` 开**，可无人确认（设置可关） | iter-40+ |

### §1 为什么你会觉得「完全不够智能」（截至 iteration 25）

**整表基准日过时**：应视为 **2025 初快照**，不可直接用于 2026 产品评审。

| 原「现状」 | 2026-05 更接近 | 迭代/模块 |
|------------|----------------|-----------|
| 规划：规则/关键词 | ⚠️ LLM JSON 计划 + 规则快路径；复杂句仍可能误判 | iter-28, iter-80 |
| 执行：失败即停 | ⚠️ Agent loop、失败 recovery 计划、`video.retry_failed` | iter-53, iter-55, iter-79 |
| 感知：仅资产卡 | ⚠️ **L1 后端**：workstate、`recentCanvasEvents`、指代解析、风格/版本/运镜锚；**UI 共感仍弱** | iter-50, 100～105 |
| 并行：**无任务中心** | 📄→✅ Job 队列 + `HermesJobCenter` + R5 双通道；**planning 时仍挡执行类消息** | iter-47, 68, 71 |
| 多模态：无语音/文档 | 📄→⚠️ **语音**侧栏 STT+Whisper（iter-65）；**剧本 doc** 有导入解析（iter-32），**非 composer 拖文档开聊** | iter-32, 65 |
| 视频：Director 无 video 工具 | 📄→✅ 已有 batch video / retry | iter-26 |
| 主动度：仅呼吸光晕 | 📄→⚠️ Orb suggest、proactive chips、灵体自动 recovery（可配置） | iter-31, 57, 69, 81, 98 |

**根因段（§1 末）**：「尚未建设认知层」→ 应改为 **「认知层已起步，表达层（UI/壳）与 Octo 式共感仍明显落后」**。

### §2.2 Octo vs Hermes 能力矩阵

| 维度 | 原「Hermes 今天」 | 勘误后 |
|------|-------------------|--------|
| 规划 | 规则 Director | ⚠️ LLM + 规则；Registry 深化的 tool gate（iter-84） |
| 感知 | 弱（资产卡快照） | ⚠️ situation + workstate + 画布事件；**无 Octo 式圈选/高亮 UI** |
| 并行 | 无统一队列 | 📄→✅ `hermesJobStore` + 媒体并发上限；体验仍偏「控制台」 |
| 视频 | 灵体未编排 | ⚠️ 工具链有；**一键叙事闭环与进度同屏**仍弱于 Octo 宣传 |
| @ 引用 | Phase D 参考素材 | ⚠️ + 画布 `@mention`、钉选条；仍非 Octo「核心资产库」产品形态 |

**仍 🎯 有效的差异化行**：本地工程、显式节点图、可选 Provider、时间线手调 — 无需改。

### §2.1 / Octo 公开描述（vision 未写全的部分）

以下为 **Octo 介绍页/内测文常见、vision 未单列** 的能力，借鉴时需知 Hermes **未对标** 或 **架构不同**：

| Octo 宣传点 | Hermes 对照 |
|-------------|-------------|
| 左对话 **右画布** 分屏同屏 | 现为画布 + **竖浮窗/侧栏**，非 Octo 主布局 |
| 单 prompt **多时段并行**（0–5s/5–10s…） | 按 beat / Director 步进，非同一 prompt 多段渲染 |
| **界面圈选**改画面 | ❌ 无 Agent 级圈选；仅有视频字幕框选等无关能力 |
| **Agent 主动发图/音**参与讨论 | ❌ 聊天 UI 未内嵌；上下文有资产卡/知识块 |
| **实时检索**（创作中搜网） | ❌ 仅有 hermes-knowledge RAG，非泛检索 |
| **XML 工程**交专业剪辑 | 时间线 → mp4/mov 等，路径不同 |
| Vibe 三法（氛围 / @指向 / 渐进明确） | 🎯 方向一致；未做成 Octo 式 onboard 教学 |

### §4.1 / §4.2 视频 Agent

| 原表述 | 勘误 |
|--------|------|
| Director 缺 `video.generate_for_beats` 是 **P0 缺口** | 📄 **已闭合**（iter-26）；§11 优先级第 1 条对 **2026 读者** 已过期 |
| 表格其他行 | 🎯 灵体「决策不 HTTP」仍有效 |

### §5.1 双形态

| 原表述 | 勘误 |
|--------|------|
| Orb「点击可预览待办 2 条」 | ⚠️ 有 suggest 气泡 + 自动 recovery；**非完整待办预览 UI** |
| Panel「任务轨」 | ⚠️ `HermesJobCenter` + task track；**占用侧栏/浮窗中间带**，与 Octo ambient 进度仍有差距 |

### §5.2 L3 规划

| 原表述 | 勘误 |
|--------|------|
| 「现状：规则 buildDirectorPlan」 | 📄→ **混合**；`hermesPlanFromIntent` 仍承担大量规则 |
| 「目标：慢路径 LLM」 | ✅ 已有；校验器、logical steps（iter-80）部分落地 |

### §5.2 L4 表达

| 组件 | 勘误 |
|------|------|
| 提案卡 | ⚠️ Situation / mixed 模式有部分；非全流程结构化 A/B 卡 |
| 阶段条可点击跳转 | ❌ 仍弱或未产品化 |
| 计划卡费用/时间预估 | ❌ 基本未做 |

### §5.3 工具表

| 工具 | 原优先级 | 勘误 |
|------|----------|------|
| `video.generate_for_beats` | P0 | ✅ |
| `video.retry_failed` | P0 | ✅ |
| `storyboard.patch_shot` | P1 | ✅ iter-54+ |
| `bible.update` | P1 | ✅ iter-30+ |
| `canvas.focus` | P1 | ✅ |
| `template.run` | P2 | ⚠️ 模板 chat 有部分；非完整 run |

### §6.1 默认对话策略

| 原表述 | 勘误 |
|--------|------|
| 创意碰撞「只聊不写」 | ⚠️ `consult` 通道是；**execute/mixed 常自动跑** |
| 建议设置项 `hermes.autoRunLowRisk` 等 | 📄 已并入 **设置 → Agent**（`agentAutoExecute` 等），键名不同 |

### §6.2 多模态同屏

| Octo / 目标 | 勘误 |
|-------------|------|
| Agent 发图/音频条 | ❌ **未实现** UI；仍为 vision 目标 |
| 上传剧本解析 | ⚠️ iter-32 **有**；入口在脚本/导入链，**非 Octo 式 composer 上传开聊** |
| 语音输入「远期」 | 📄→✅ iter-65 |

### §6.3 并行任务

| 原表述 | 勘误 |
|--------|------|
| `HermesTask` 最小模型 | ⚠️ 有 job store + task track；**类型与 vision 草图不完全一致** |
| 侧栏底部固定任务轨 | ⚠️ 有 JobCenter；**浮窗模式中间插入**，非 Octo ambient |
| 对话可继续 | ⚠️ **consult 始终可**；**planning 时 execute/mixed 不可**（`hermesParallelChannel.ts`） |
| 取消第 N 镜 job | ⚠️ Job 级 cancel 有；自然语言「取消第 2 镜」未完整 |

### §8.1 智能度分级 S1～S5

| 级别 | 原「今天/关键技术」 | 建议读者理解 |
|------|---------------------|--------------|
| S1 | 今天 | 仍成立 |
| S2 | +video + situation | ⚠️ ** largely 已达** |
| S3 共感 | +选中 + bible | ⚠️ bible/选中有；**UI 共感未达 Octo** |
| S4 并行伙伴 | +任务中心 + LLM | ⚠️ **后端 largely 已达**；壳层体验未达 |
| S5 主动制片 | +Orb + 建议 | ⚠️ **部分已达**（orb/chips/recovery） |

### §8.2 迭代表

| 勘误 |
|------|
| 表止于 iter-32；**未收录** 40～105（并行、voice、job center、workstate、指代 P1～P5、expert 层等） |
| 建议在母文档追加 **「§8.2 续表」** 或链到 [HERMES_CURSOR_AGENT_SPEC.md](./HERMES_CURSOR_AGENT_SPEC.md) §8 |

### §10 代码锚点

| 勘误 |
|------|
| 缺：`HermesFloatPanel.tsx`、`HermesJobCenter.tsx`、`hermesWorkstate.ts`、`hermesCanvasEvents.ts`、`hermesParallelChannel.ts`、`hermesJobStore.ts` |
| `HermesSidebar.tsx` 现同时服务 float + chatOnly |

### §11 总结优先级（四条 P0/P1）

| 原优先级 | 2026 状态 |
|----------|-----------|
| 1. 视频进 Director | ✅ 完成 → **后续：编排体验、就绪检查文案、与 Octo 进度同屏** |
| 2. 任务轨 + 感知快照 | ⚠️ 快照 ✅ / 任务轨 ⚠️ / **UI 感知 ❌** |
| 3. LLM 规划 | ✅ 完成 → **持续：误判、混合意图、防幻觉** |
| 4. 圣经 + 主动建议 | ⚠️ 圣经 ✅ / 建议 ⚠️ / **角色库运营 ❌** |

**建议替换的 2026 优先级（Octo 对标 · 体验层）**：

1. **壳层 IA**：对话区主、工具/任务 ambient（Orb + 一行 peek）  
2. **UI 共感**：选中/改镜画布反馈 + 侧栏短句，非 situation 全文  
3. **多模态表达**：Agent 消息内嵌可折叠预览；composer 统一上传入口  
4. **并行体验**：planning 期间策略（排队 vs 拒绝）、与 Octo 一致的「边聊边跑」感知  

---

## 3. vision 仍准确、不必改动的 Octo 对标原则

以下在 iter-105 后 **仍然成立**，与勘误不冲突：

- **学关系不抄壳**：Vibe Create = 合伙人，不是工单客服（[`HERMES_CURSOR_AGENT_SPEC.md`](./HERMES_CURSOR_AGENT_SPEC.md) 已强化）。  
- **画布 SSOT**：节点图可审计，灵体是驾驶舱。  
- **本地 + 可选模型**：相对 Octo 云一体是 **刻意差异**。  
- **不复制 Octo 全 UI**（§8.3）：包括分屏 Agent 页、黑盒成片。  
- **视频智能在 L3 决策层**：不重复 HTTP 客户端（§4.2 原则）。

---

## 4. 与 HERMES_CURSOR_AGENT_SPEC 的分工

| 文档 | 角色 |
|------|------|
| **HERMES_SPIRIT_VISION** | 母愿景、Octo 关系、视频 Agent 架构 **（历史快照 + 方向）** |
| **HERMES_SPIRIT_VISION_ERRATA（本文）** | vision 过时句对照 **实现 truth** |
| **HERMES_CURSOR_AGENT_SPEC** | PRD 级现网规格、六维能力、Agent 设置 **（iter-40+ 更贴近现网）** |

读 Octo 对标时：**Spec + 本勘误 > Spirit Vision §1/§8**。

---

## 5. 后续维护建议

1. 每完成 5～10 个 Hermes 迭代，更新本表「快照日期」与 §2 行。  
2. 不在 vision 正文大改历史段落；重大状态变更写入本勘误或 Spec。  
3. Octo 新公开能力先入 §2.1 补充表，再决定是否进 roadmap。

---

*生成说明：对照 `src/lib/hermes/**`、`src/components/hermes/**`、`docs/iterations/iteration-{26..105}-hermes*.md` 与公开 Octo 报道整理。*
