# iter-112 · Composer 统一上传 ✅

**层级**：CanvasExperienceLayer  
**前置**：iter-111 消息内嵌预览  
**P1 归属**：Octo gap · 多模态表达（原路线图 Phase 3 iter-111）

## 1) 本轮目标

剧本/参考从 **composer 一条链路进**：选文件 → 聊天短确认 → 用户点按钮写入（**非自动覆盖**）。

## 2) 变更范围

- `hermesComposerUpload.ts`、`HermesComposerUploadActions.tsx`
- `HermesSidebar.tsx`（上传钮 + 确认条）
- `importScriptDocument.ts`（复用 pick/analyze/apply）
- `HermesWxIcons.tsx`、`hermes-shell.css`

## 3) 功能清单

1. **Composer 上传钮**：与语音/发送同排；支持 txt/md/docx（Rust `extract_script_document`）。
2. **聊天 ack**：读取成功后 assistant 一行摘要（字数、warn/block），明确「未写入画布」。
3. **确认条**：「写入脚本 / 导入并解析 / 取消」；block 缺口禁用写入。
4. **复用脚本链**：`applyScriptDocumentImport` 与脚本节点「上传剧本」一致。

## 4) 非目标

- 拖放进 textarea
- 无脚本节点时自动创建
- 云端文档协作

## 5) 验收

1. 打开工程 → composer 📄 钮 → 选剧本 → 聊天出现短确认，画布未变。
2. 点「写入脚本」→ 脚本/上游文本更新；点「导入并解析」→ 走 AI 解析。
3. 过短剧本 → block，按钮 disabled。
4. `npm run test -- hermesComposerUpload`

## 6) UI/UX

- 上传钮 18px icon，与 `hermesFloatInputIconBtn` 一致。
- 确认条 dashed cyan 边框，不撑高浮窗主聊天区。

## 7) 回退

移除上传钮与 `HermesComposerUploadActions`；恢复仅脚本节点内上传。
