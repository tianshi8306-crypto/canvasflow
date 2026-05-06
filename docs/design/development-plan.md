# 开发方案：DAG 影视流水线 × 当前仓库

本文档在 [`architecture-spec-vs-implementation.md`](./architecture-spec-vs-implementation.md) 与 [`../iterations/ROADMAP_V2.md`](../iterations/ROADMAP_V2.md) 之上，给出**可排期、可验收**的技术向开发方案；产品向「九轮」节奏仍以 ROADMAP 为准，此处补充**底层纵轴**（资产、执行、端口），避免体验迭代与引擎脱节。

---

## 1. 目标与原则

### 1.1 北极星

- 画布上的图既是**编辑态**，也是**可执行 DAG**；运行结果可追踪、可部分重跑。
- 媒体与生成物通过**统一资产层**寻址，节点间不传大块二进制。
- **单一执行入口**：长期收敛「点运行」与「单节点生成」到同一套调度语义（允许过渡期双轨，需明确废弃路径）。

### 1.2 约束（与 ROADMAP 一致）

- 每阶段 1 个核心目标；每阶段可验收步骤 3～5 条。
- 优先「打穿一条纵轴」，再横向铺节点类型。
- 破坏性改动需兼容旧 `canvasflow.json` 或通过迁移脚本升级版本号。

---

## 2. 分层与依赖关系

```mermaid
flowchart TB
  subgraph foundation [阶段 A 地基]
    A1[资产注册表 asset_id + 元数据]
    A2[节点输出契约 outputs 引用资产]
  end
  subgraph graph [阶段 B 图语义]
    B1[端口类型与连线校验]
    B2[FlowNodeData 与 schema 对齐]
  end
  subgraph engine [阶段 C 执行引擎]
    C1[节点级状态机 + 事件落库]
    C2[失败策略与可续跑子图]
    C3[无依赖并行可选]
  end
  subgraph verticals [阶段 D 业务纵轴]
    D1[脚本时间轴与镜头 ID]
    D2[视频 / 音频 / 合成算子接入执行器]
  end
  foundation --> graph
  graph --> engine
  engine --> verticals
```

**说明**：没有 A，B 的「类型」没有锚点；没有 B，C 的「按节点调度」与 UI 易不一致；没有 C，D 的各节点只会继续堆 `invoke` 碎片。

---

## 3. 阶段划分与交付物

### 阶段 A：资产与协议（优先）

| 项 | 内容 | 交付物 | 验收要点 |
|----|------|--------|----------|
| A.1 | **资产注册**：导入/生成文件写入工程目录后，生成稳定 `asset_id`（UUID 或 ULID），落库（扩展现有 `assets` 表或新表） | Rust API：`register_asset` / `get_asset`；前端通过 id 解析预览路径 | 同一路径重复注册幂等；重启工程仍可解析 |
| A.2 | **节点数据引用改造**：`path` 逐步改为 `assetId` 或 `assetRef`（可保留 path 作迁移期双写） | `FlowNodeData` 扩展字段 + `serialization` 版本迁移 | 旧工程打开不丢图；新保存可只存 id |
| A.3 | **元数据最小集**：图片宽高、音视频时长等写入 `meta_json` | 导入时 `ffprobe`/图片解码探针（可异步） | 下游节点可读 meta，无需再扫文件 |

**风险**：迁移与双写期较长，需定义「何时删 path 只读」里程碑。

---

### 阶段 B：端口与连线语义

| 项 | 内容 | 交付物 | 验收要点 |
|----|------|--------|----------|
| B.1 | **端口类型枚举**：如 `text`、`image`、`video`、`audio`、`scriptBeats`（初版可粗粒度） | 前端：Handle 带类型；连线时校验 | 非法连线拒绝或提示原因 |
| B.2 | **边数据模型**：`edge` 上可选 `data: { payloadType }` 或与 handle id 绑定类型 | `onConnect` 校验 + 单元测试 | 与 React Flow 存盘兼容 |
| B.3 | **算子输入映射**：执行器从上游 outputs 取资产 id / 文本，按节点类型解析 | Rust：`resolve_inputs(node_id)` | 与当前 `incoming_texts` 行为等价或覆盖 |

---

### 阶段 C：执行引擎增强

| 项 | 内容 | 交付物 | 验收要点 |
|----|------|--------|----------|
| C.1 | **节点级状态**：`idle | pending | running | succeeded | failed | skipped` 写入 `run_events` 或新表 | 前端订阅或轮询展示节点角标 | 与 ROADMAP「状态反馈」对齐 |
| C.2 | **失败策略**：默认「失败则标记下游为 skipped」；可选「整图中止」（配置项） | `executor` 分支逻辑 + 测试用例 | 与设计文档「阻断下游」一致 |
| C.3 | **子图重跑**：输入为 `failed_node_id` 或 `from_node_id`，对依赖闭包重算 | 新 command：`execute_subgraph` | 不重跑已成功节点（除非显式强制） |
| C.4 | **并行（可选）**：拓扑分层，同层无依赖节点 `join!` | 限流并发数，避免 API 打爆 | 可后置于 C.1～C.3 稳定后 |

**依赖**：阶段 A 的资产 id 在执行器输出 `HashMap` 中应可区分类型（或 value 用枚举/JSON）。

---

### 阶段 D：业务纵轴（与 ROADMAP R3～R6 交叉）

| 项 | 内容 | 说明 |
|----|------|------|
| D.1 | **脚本 ↔ 时间轴**：`ScriptBeat` 增加或推导 `shotId`、时间码；变更时发事件或脏标记下游 | 与 R3/R4 分镜工作台同一数据模型 |
| D.2 | **视频生成算子**：图生视频/文生视频从「仅前端 invoke」迁入 `executor` 可调度单元 | 与 R5 一致 |
| D.3 | **TTS / 音频**：占位替换为真实算子，输出音频资产 id | 接入阶段 A |
| D.4 | **合成升级**：由单纯 concat 走向「时间线描述 JSON + FFmpeg」，仍可通过 Rust 调用 | 与 R6 一致 |

---

### 阶段 E：预览与导出（中长期）

| 项 | 内容 |
|----|------|
| E.1 | 时间线预览：合成结果或代理片段的 Web 侧播放（不必首版 WebGL） |
| E.2 | 增量刷新：单镜头变更仅重算对应片段（依赖资产版本号或输出 hash） |

---

## 4. 与现有 ROADMAP 九轮的配合方式

| ROADMAP 轮次 | 建议叠加的底层工作 |
|--------------|-------------------|
| R1～R2 | A.1 最小资产 id；保存/load 不破坏 |
| R3～R4 | D.1 镜头与时间轴模型与脚本数据统一 |
| R5 | D.2 + C.1 节点状态在生成中可见 |
| R6 | D.4 + 导出算子化（可为「虚拟导出节点」或命令） |
| R7+ | C.3/C.4、E 类能力编排与观测 |

**原则**：产品轮次不阻塞 A/C 的「窄实现」——例如可先完成 **A.1 + C.1** 仅针对 `textNode`+`llm`，再扩展到媒体节点。

---

## 5. 里程碑建议（按季度/版本可裁剪）

| 里程碑 | 包含阶段 | 可演示结果 |
|--------|----------|------------|
| **M1** ✅ | A.1 + A.3（部分） | 新导入素材有 asset id，预览优先 id；见 [`milestone-M1-issues.md`](./milestone-M1-issues.md) |
| **M2** | B.1 + B.2 | 非法连线无法在画布持久化；见 [`milestone-M2-issues.md`](./milestone-M2-issues.md) |
| **M3** | C.1 + C.2 | 一次运行可见每节点成功/失败；失败下游跳过；见 [`milestone-M3-issues.md`](./milestone-M3-issues.md) |
| **M4** | C.3 | 从失败节点一键重跑子图；见 [`milestone-M4-issues.md`](./milestone-M4-issues.md) |
| **M5** | D.1 + D.2 试点 | 脚本镜头 id 驱动至少一条视频生成链路；见 [`milestone-M5-issues.md`](./milestone-M5-issues.md) |

---

## 6. 风险与对策

| 风险 | 对策 |
|------|------|
| 双轨执行（前端 invoke vs `execute_graph`）长期并存 | 列清单标注「仅 UI」「仅引擎」；每季度收敛一条 |
| 旧工程迁移成本高 | `CanvasFileV1` 升 `v2`；迁移函数单测 |
| 并行与云端限流 | 并发上限、队列、退避；先串行正确再并行 |
| 团队并行冲突 | 地基（A/B）由一人或小组锁文件（`executor.rs`、`types.ts`） |

---

## 7. 文档维护

- 本方案随 `architecture-spec-vs-implementation.md` 更新而修订**里程碑与阶段优先级**。
- 每完成一里程碑，在对照表中更新 ✅/⚠️/❌ 列，保持单一真源。

---

## 相关链接

- [设计规格与实现对照表](./architecture-spec-vs-implementation.md)
- [路线图 V3](../iterations/ROADMAP_V2.md)
- [LibTV 指南对齐](../product/LIBTV_GUIDE_ALIGNMENT.md)
- [UI 迭代指南](./UI_ITERATION_GUIDE.md)
