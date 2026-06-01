# 产品状态矩阵（2026-05-26）

> 与 [`CURRENT_PROGRESS.md`](../iterations/CURRENT_PROGRESS.md)、[`ROADMAP_V2.md`](../iterations/ROADMAP_V2.md) 同步。  
> **Hermes Agent** 另见 [`HERMES_CURSOR_AGENT_SPEC.md`](./HERMES_CURSOR_AGENT_SPEC.md)（iter-45～85）。

| 区块 | 状态 | 说明 |
|------|------|------|
| **R1～R4 + 合成基础** | 主体可用 | 工程/画布、脚本工作台、分镜、Hermes 串联、剪辑台 iter-18～20 |
| **R5 视频** | UI 迭代中 | iter-86/87 面板与轮询；**iter-90** 设置测试连接 |
| **R6 时间线** | 基础 + 剪辑台 | 多轨/转场等 **冻结**（iter-18），属远期非遗漏 |
| **阶段 5 Epic** | 未排期 | E1～E4 backlog；**E5** iter-91/92 批量出图 + 失败重试 |
| **参考视频「真理解」** | 缺口 | iter-88：路径 + **ffprobe 元信息**；非视频模型理解（E2 Epic） |
| **Inspector 侧栏** | 刻意未挂壳 | `Inspector.tsx` 保留样式；[`GOLDEN_PATH.md`](./GOLDEN_PATH.md) 不重挂 |
| **黄金路径 P0/P1** | ✅ iter-95 | E2E 4 条 + B 档 P0/P1 清单 · [`iteration-95-golden-path-p0-p1.md`](../iterations/iteration-95-golden-path-p0-p1.md) |

## 明确不做（评审门禁）

- LibTV 式底部生成器 Dock  
- 运行时挂载右侧 `Inspector` 作主编辑壳  
- iter-18 冻结的 R6 多轨/转场（除非单独立项解冻）  
