# iter-92 · E5 重试失败关键帧

## 目标

分镜区对齐「重试失败视频」：仅重试范围内 `storyboardShots.status === failed` 的镜头，并尊重分镜组范围。

## 范围

- `scriptProductionExport.ts` · `listFailedKeyframeBeatIds`
- `ScriptStoryboardSection.tsx` · 按钮 + `retryFailedKeyframes`

## 非目标

- Hermes `image.retry_failed` Tool（可 iter-93）
- 无图片节点时自动建链（仍走「批量出关键帧」）

## 验收

1. 2 镜出图失败 → 「重试失败关键帧（2）」可点 → 仅重提失败镜  
2. 失败镜无图片节点 → 提示先「批量出关键帧」  
3. `npm run test -- scriptProductionExport`

## 回退

移除按钮与 `listFailedKeyframeBeatIds` 调用。
