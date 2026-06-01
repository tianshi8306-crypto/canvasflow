# Iteration 65 — I4 语音输入

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.1 I4 · P2

## 1) 目标

Hermes 侧栏输入框启用麦克风：语音转文字填入 composer，用户确认后发送。

## 2) 范围（3 模块）

- `hermesVoiceInput.ts` + `useHermesVoiceInput.ts` — 识别逻辑与 Hook
- `HermesSidebar.tsx` — 麦克风按钮与状态行
- `transcribe_speech_audio`（Rust）— Whisper 回退

## 3) 功能

1. **浏览器 STT**（优先）：Web Speech API，`zh-CN`，实时 interim + final 追加到输入框
2. **Whisper 回退**：无浏览器 STT 时，Tauri 内录音 → OpenAI 兼容 `/audio/transcriptions`
3. 录音/识别中状态行；麦克风按钮 `--listening` 脉冲样式
4. 权限/网络/API 错误 → 顶栏 statusText 提示

## 4) 非目标

- 语音直接发送（不经过用户确认）
- 本地离线 Whisper 模型
- 语音唤醒 / 连续对话

## 5) UI/UX

- **界面**：Hermes 浮层/侧栏 composer 左下麦克风
- **状态**：idle / listening（cyan 脉冲）/ transcribing
- **键盘**：Enter 仍发送；语音不抢焦点

## 6) 验收

1. Chromium / Tauri：点击麦克风 → 说话 → 文本追加到输入框
2. WebView2 无 STT 时：录音 → 停止 → Whisper 识别（需 OpenAI Key）
3. 拒绝麦克风 → 友好错误提示
4. `npm run test -- hermesVoiceInput` 通过

## 7) 状态

✅ 已实现（iter-65 / P2-I4）
