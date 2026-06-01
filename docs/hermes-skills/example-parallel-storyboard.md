---
id: parallel-storyboard
name: 并行分镜出图
description: 多镜同时提交关键帧，缩短等待
---

# 并行分镜出图

当用户说「并行出图」「多路出图」时：

1. 确认脚本节点与分镜已就绪。
2. 使用 `agent_delegate_parallel` / `image_generate_for_beats` 按镜号分组（最多 3 路）。
3. 执行后在画布逐镜审核，不自动进入视频 unless 用户明确要求。
