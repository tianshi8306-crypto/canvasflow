# iter-88 · 参考视频 ffprobe 元信息（非真理解）

## 目标

脚本解析注入路径 + 时长/分辨率（ffprobe）；UI 横幅展示；**不**做视频模型理解。

## 范围

- `script_node.rs`、`probe_project_rel_media`、`scriptReferenceVideo*.ts`、`ScriptReferenceVideoBanner.tsx`

## 验收

1. 连线参考视频并导入文件 → 横幅显示 `1920×1080, 12.0s` 等  
2. 脚本解析 prompt 含元信息后缀  
3. 真理解仍归 Epic E2  
