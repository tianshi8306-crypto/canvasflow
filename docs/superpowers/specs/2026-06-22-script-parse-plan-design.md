# 脚本节点 · 需求理解 + 分镜分解 设计规格

**Date:** 2026-06-22  
**Status:** 设计定稿（待实现）  
**关联代码：** `script_node.rs` · `script_pipeline.rs` · `script_decision.rs` · `script_parse_requirement.rs` · `script_shot_agent.rs` · `MinimalScriptNode.tsx`

---

## 1. 背景与产品共识

用户希望脚本节点扮演**分镜师助手**，而不是 keyword → 参数的映射器。

| 决策 | 结论 |
|------|------|
| 理解方式 | **规则 + LLM 混合** |
| 前期能力 | **切镜 / 景别 / 运镜**（分镜师域） |
| 输出主形态 | **可继续改的分镜稿**（整份文本） |
| 结构化数据 | `scriptBeats` 保留，供下游视频 / 分镜出图 |
| brief 模糊 | LLM 读上游剧本 → **自动规划 → 静默执行** |
| 规划可见性 | **不向用户展示** plan 卡片或摘要 |
| 编辑载体 | **节点预览区大文本框**，直接改整稿 |

### 1.1 与现状差距

```
现状                              目标
────────────────────────────────────────────────────────────
brief → parse_requirement_hints   brief + 剧本 → ScriptParsePlan
规则改阈值                         规则执行 plan 中的分镜策略
输出 scriptBeats 为主              storyboardDraft 为主、beats 为辅
预览：迷你镜头表                   预览：可编辑分镜稿大文本框
brief 空 → 报错或短默认              brief 空 + 有上游 → LLM 自动规划
```

---

## 2. 一句话目标

**读 brief + 读剧本 → 静默生成任务计划 → 规则切镜骨架 → LLM 逐镜润色 → 拼成可编辑分镜稿写入节点预览。**

---

## 3. 系统架构

### 3.1 四阶段管线

```
┌──────────────┐   ┌──────────────┐
│ 上游剧本文本  │   │ 底栏 brief   │
└──────┬───────┘   └──────┬───────┘
       │                  │
       └────────┬─────────┘
                ▼
    ┌───────────────────────────┐
    │ 阶段 0 · 任务计划 Plan     │  ← 新增
    │ 规则硬约束 + LLM 语义理解   │
    └─────────────┬─────────────┘
                  ▼
    ┌───────────────────────────┐
    │ 阶段 1 · 剧本理解          │  现有 analyze_script_structure
    │ 场/段/角色/对白/情绪        │
    └─────────────┬─────────────┘
                  ▼
    ┌───────────────────────────┐
    │ 阶段 2 · 分镜骨架          │  现有 design_shots + script_decision
    │ 切镜/景别/运镜/时长         │  输入改为 Plan（非裸 hints）
    └─────────────┬─────────────┘
                  ▼
    ┌───────────────────────────┐
    │ 阶段 3 · 逐镜 LLM          │  现有 script_shot_agent
    │ 画面/Seedance/分镜块       │
    └─────────────┬─────────────┘
                  ▼
    ┌───────────────────────────┐
    │ 阶段 4 · 呈现              │  ← 新增/改
    │ storyboardDraft + beats    │
    └───────────────────────────┘
```

### 3.2 规则 vs LLM 职责

| 阶段 | 规则引擎 | LLM |
|------|----------|-----|
| **Plan** | 集数截取、显式时长、否定词、体裁默认 profile | brief 意图；**brief 模糊时读剧本定体裁/范围/节奏** |
| **骨架** | 切镜、merge/split 阈值、景别运镜决策树 | 不参与 |
| **逐镜** | 硬性字段（景别/运镜/时长数值不可违背） | 画面描述、台词、Seedance、分镜块润色 |
| **呈现** | 拼接 `storyboardDraft` 模板 | 可选：整稿连贯性 pass（P2） |

---

## 4. 核心数据结构

### 4.1 `ScriptParsePlan`（内部，仅日志/调试，不写入节点 UI）

Rust 模块建议：`src-tauri/src/executor/script_parse_plan.rs`

```rust
pub struct ScriptParsePlan {
    /// 合并后的可执行约束（由 requirement_hints + LLM 覆盖/补全）
    pub hints: ScriptParseRequirementHints,
    /// 体裁（短剧/电影/广告/动漫）
    pub style: ScriptStyleProfile,
    /// 切镜密度 profile（已有 CutProfile 逻辑）
    pub cut: CutProfile,
    /// LLM 生成的 brief 摘要（内部用，不展示）
    pub brief_summary: String,
    /// 规划来源：UserBrief | AutoFromScript | Hybrid
    pub plan_source: PlanSource,
    /// 是否因 brief 模糊触发了自动规划
    pub auto_planned: bool,
}
```

**Plan 生成顺序：**

1. `parse_requirement_hints(brief)` → 规则初稿  
2. 若 `is_brief_vague(brief)` 且存在上游正文 → 调用 `plan_from_script_llm`  
3. `merge_plan(rule_hints, llm_plan)` → 显式 brief 优先，LLM 补空白  
4. `resolve_cut_profile(&hints)` + `resolve_style` → 完整 `ScriptParsePlan`

**brief 模糊判定（规则）：**

```text
trim 为空
或 仅匹配 coarse 体裁词（短剧/电影/广告/…）
或 字数 < 8 且无时长/集数/景别等显式约束
→ 视为 vague，触发 LLM 读剧本
```

### 4.2 节点数据 · 新增字段

TypeScript（`FlowNodeData`）：

```typescript
/** 节点预览主交付：整份可编辑分镜稿 */
storyboardDraft?: string;

/** 分镜稿版本号：每次解析 +1；用户手改不改此字段（P0） */
storyboardDraftRevision?: number;

/** 最近一次解析是否走了自动规划（仅 Inspector/调试，预览不展示） */
scriptParseAutoPlanned?: boolean;
```

**现有字段保留：**

- `prompt` — 底栏 brief（解析要求），与上游剧本分离  
- `scriptBeats[]` — 结构化镜头，下游视频/分镜/导出  
- `storyboardShots[]` — 出图缓存，按 `scriptBeatId` 关联  
- `scriptRhythmReport` · `scriptTotalDurationSec` · `scriptShotCount`

### 4.3 分镜稿格式（`storyboardDraft`）

由执行器拼接，用户可在预览大框自由改。推荐块分隔符：

```markdown
---
镜 1-1-01 · 建立 · 2.5s
场：1-1日 外 悬崖
景别：全景 · 运镜：缓慢推 · 角度：平视

【画面】悬崖边，陈南与师父切磋…

【对白】师父：陈南，你已上山修炼十五年有余…

【声音】环境声 · 剪辑：建立空间
---

镜 1-1-02 · 推进 · 2.0s
…
```

**拼接规则（P0）：**

- 每镜一块，以 `---` 分隔  
- 内容来自 `format_shot_storyboard_block` + 规则决策字段  
- 解析完成后写入 `storyboardDraft`，并 `storyboardDraftRevision += 1`

**与 beats 关系（P0）：**

- **解析产出：** beats 与 draft **同源**（同一轮 parse 生成）  
- **用户改 draft：** 仅改 `storyboardDraft`，**不自动回写 beats**（避免静默破坏下游）  
- **P1 可选：** 顶栏/Inspector「从分镜稿同步镜头表」按钮，解析 draft → beats

---

## 5. LLM 接口设计

### 5.1 `plan_from_script_llm`（阶段 0，单次调用）

**触发：** `is_brief_vague(brief) && has_upstream_text`

**输入：**

- 上游剧本前 N 字（建议 8000，超出截断 + 说明）  
- brief（可为空）  
- 参考视频路径摘要（若有）

**输出 JSON（camelCase）：**

```json
{
  "styleProfile": "short_drama",
  "episodeOnly": 1,
  "cutDensity": "dense",
  "shotSizeBias": "close_up",
  "preferReactionShots": true,
  "perShotDurationSec": 2.5,
  "briefSummary": "竖屏短剧第一集，武侠开场，快节奏特写为主",
  "scopeNote": "仅第一集，含1-1与1-2两场"
}
```

**约束：**

- 只填「规划字段」，不输出镜头列表  
- 失败时 fallback：`ScriptParsePlan::default_short_drama(body)`（静默，不报错）  
- 结果只写入 `db::log_event(plan_merged)`，**不 emit 到前端 UI**

### 5.2 逐镜 LLM（阶段 3，现有 `script_shot_agent`）

**改动：**

- `ShotVisualContext` 扩展携带 `plan: &ScriptParsePlan`（或 brief_summary + style）  
- system prompt 按 `style` 切换模板（短剧/电影/广告），不再写死竖屏短剧  
- user prompt 注入 `plan.brief_summary` 替代裸 `requirement_text`（brief 空时仍有语义）

---

## 6. 规则引擎接入 Plan

### 6.1 现有能力复用

| 模块 | 调整 |
|------|------|
| `script_parse_requirement.rs` | hints 仍由规则解析；作为 plan 子集 |
| `scope_script_to_episode` | 由 `plan.hints.episode_only` 驱动 |
| `design_shots` | 入参改为 `Option<&ScriptParsePlan>`，内部取 `plan.hints` + `plan.cut` |
| `script_decision` | `DecideContext` 带 `plan.style` + hints |
| `apply_requirement_hints_to_shots` | 不变 |

### 6.2 不再扩展的方向

- 停止向 `parse_requirement_hints` 堆更多 keyword  
- 新语义需求优先走 **Plan LLM** 或 **逐镜 LLM**

---

## 7. 前端设计

### 7.1 预览区：大文本框（P0 核心 UI）

**组件：** 新建 `ScriptNodeDraftPreview.tsx`，替换有 beats 时的 `ScriptNodeMiniPreview`。

| 状态 | 预览区 |
|------|--------|
| 无 beats 且无 draft | 空态占位（现有） |
| 解析中 | 居中胶囊进度条（现有） |
| 解析完成 / 有 draft | **大 `<textarea>`**，绑定 `storyboardDraft` |

**交互：**

- `onChange` → `updateNodeData(id, { storyboardDraft })`  
- debounce 300ms 持久化到 project store  
- 壳高度：有 draft 时沿用 `computeScriptNodeFrameSize`，min-height 保证 ≥12 行可视  
- 字体：等宽或现有 `mono` token，便于看镜号  

**不展示：**

- auto plan 摘要  
- plan JSON / parseHints  

### 7.2 底栏 brief（不变契约）

- 上游 = 剧本  
- 底栏 = 解析要求  
- 允许空 brief（有上游时）：触发自动规划  
- 触发条件调整：`resolveScriptParseRequirement` 在有上游时，空 brief 也允许解析  

### 7.3 全屏 / Inspector

- **P0：** 全屏工作台仍以 `scriptBeats` 表为主；预览大框为画布快速编辑入口  
- **P1：** 全屏增加「分镜稿」Tab，与节点预览同一 `storyboardDraft` 字段  

### 7.4 帧尺寸

```typescript
// scriptNodeChrome.ts
computeScriptNodeFrameSize(hasDraft: boolean, draftLines: number)
// 有 draft：宽不变，高随行数 clamp(280, 480)
```

---

## 8. 执行器输出 Patch

解析成功后 `script_node` 返回 patch：

```json
{
  "scriptBeats": [...],
  "scriptBeatSelection": [...],
  "storyboardDraft": "整份分镜稿…",
  "storyboardDraftRevision": 3,
  "scriptParseAutoPlanned": true,
  "scriptRhythmReport": {...},
  "scriptTotalDurationSec": 90.5,
  "scriptShotCount": 42
}
```

**重跑解析：**

- 覆盖 `storyboardDraft` 与 `scriptBeats`  
- `storyboardDraftRevision++`  
- 保留 `storyboardShots` 中仍匹配 `scriptBeatId` 的项（现有 selection 逻辑延伸）

---

## 9. 事件与日志

| 事件 | 用途 | 前端 |
|------|------|------|
| `script-parse-progress` | 逐镜进度 | 胶囊 % |
| `script_parse_request` | 含 `parsePlan`（脱敏） | 不展示 |
| `script_plan_auto` | auto_planned=true | 不展示 |
| `script_pipeline_stage12` | 镜数/时长 | 不展示 |

---

## 10. 实现分期

### P0（MVP，对齐产品共识）

1. **`ScriptParsePlan`** + `is_brief_vague` + `merge_plan`（规则 only fallback，LLM 可 mock）  
2. **`plan_from_script_llm`** 单次调用 + 失败 fallback  
3. 管线接入 Plan：`design_shots` / `script_decision` / `script_shot_agent`  
4. 执行器输出 **`storyboardDraft`** 拼接  
5. **`ScriptNodeDraftPreview`** 大文本框 + 空 brief 可解析  
6. 测试：vague brief + episode1 fixture → draft 非空 + beats 数量合理  

### P1

1. 全屏「分镜稿」Tab  
2. 「从分镜稿同步镜头表」  
3. 按 style 切换 shot_agent system prompt 模板  
4. brief 非空时 LLM 做 **hybrid merge**（显式约束优先）

### P2（非目标前期）

- 整稿 LLM 连贯性 pass  
- draft ↔ beats 双向实时 sync  
- 编剧域（人物弧、对白改写）

---

## 11. 非目标

- 规划结果 UI 卡片 / 多方案选择  
- 按镜卡片替代大文本框作为主编辑  
- 移除 `scriptBeats` 或全屏表  
- 用户可见的 parseHints / CutProfile 调试面板  

---

## 12. 验收标准（P0）

1. 上游连剧本，底栏只写「短剧」或**留空** → 静默解析，预览出现**可编辑分镜稿**。  
2. 底栏写「先输出第一集」→ 仅第一集内容进入 draft + beats。  
3. 底栏写「电影」→ 镜数少于同剧本「广告」解析（切镜密度差异可观测）。  
4. 用户在预览大框改字 → 保存工程后再开，draft 保留；`scriptBeats` 不变直至重跑解析。  
5. 重跑解析 → draft 与 beats 均更新，`storyboardDraftRevision` 递增。  
6. 全流程无 plan 摘要弹窗或状态条。

---

## 13. 文件变更清单（实现时）

| 层 | 文件 | 变更 |
|----|------|------|
| Rust | `script_parse_plan.rs` | 新建 Plan + merge + vague 判定 |
| Rust | `script_plan_agent.rs` | 新建 Plan LLM |
| Rust | `script_node.rs` | 阶段 0；输出 draft |
| Rust | `script_pipeline.rs` | 入参 Plan |
| Rust | `script_shot_agent.rs` | context 带 plan；style 模板 |
| TS | `types.ts` | `storyboardDraft` 等字段 |
| TS | `ScriptNodeDraftPreview.tsx` | 新建 |
| TS | `MinimalScriptNode.tsx` | 预览切换 |
| TS | `scriptParseDefaults.ts` | 空 brief + 上游可解析 |
| CSS | `MinimalScriptNode.css` | draft textarea 样式 |

---

## 14. 风险与对策

| 风险 | 对策 |
|------|------|
| draft 与 beats 双源不一致 | P0 单向；P1 显式同步按钮 |
| Plan LLM 慢/贵 | 单次调用；失败 fallback 规则 |
| 大 draft 卡 UI | 预览区虚拟滚动或 max-height + scroll（P0 先 scroll） |
| 重跑解析覆盖用户改过的 draft | 顶栏解析前确认（P1）；P0 重跑即覆盖 |

---

**下一步：** 按 §10 P0 拆 task 开始实现；建议先做 `ScriptParsePlan` + draft 拼接 + 预览 textarea，再接入 Plan LLM。
