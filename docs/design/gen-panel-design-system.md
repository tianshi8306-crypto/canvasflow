# 生成参数面板设计规范（以视频面板为真源）

> **真源实现**：`VideoMultimodalInputPanel` + `.videoGenPanel--chrome`（`VideoGenerationPanel.css`）  
> **适用范围**：图片 IGP、文本/脚本 Composer、音频 ATP、视频合成 FCP，及未来新增生成底栏  
> **对齐背景**：LibTV 1.2.x「看参考 → @ 引用 → 写 prompt → 调参 → 生成」闭环；CanvasFlow 形态为 **节点外 Portal + 展开 Modal**，非底部 Dock

---

## 1. 设计目标

| 原则 | 说明 |
|------|------|
| **正文优先** | 提示词/文案是主角；参考图、@ pill、参数钮是辅助，密度高但不抢视线 |
| **一层皮肤** | 面板内无「框中框」：参考条、输入区、底栏与面板 **同色底**（`#2b2b2b`），禁止独立暗条/渐变带 |
| **左对齐** | 顶栏 Tab、参考缩略图、正文左缘 **同一垂直起始线**（仅面板 `14px` 内边距，子区不再水平 inset） |
| **圆角统一** | 所有可点击控件（Tab、模型、输出参数、生成钮）均为 **8px 圆角矩形**；`pill` token 与 `square` 同值，禁止 999px 胶囊（进度条/圆形拖拽点除外） |
| **可扫读错误** | 校验/任务失败进状态轨，单行可扫；不在缩略图上堆叠语义重复的 badge |

---

## 2. 壳层 Token（所有生成面板共用）

定义于 `nodeChrome/nodeChromeTokens.css` 的 `--gen-panel-*`，各面板 `--vgp-*` / `--igp-*` / `--tgp-*` / `--atp-*` / `--fcp-*` 应映射同一数值：

| Token | 值 | 说明 |
|-------|-----|------|
| `--gen-panel-width` | `500px` | Portal / 展开 Modal 同宽 |
| `--gen-panel-pad` | `12px 14px 14px` | 禁止再用 `8px 12px` 扁 padding |
| `--gen-panel-bg` | `#2b2b2b` | 与节点壳 `#2b2b2b` 一致；**不是** preview `#1f1f1f` |
| `--gen-panel-max-height` | `min(calc(100vh - 88px), 360px)` | 底栏随内容，过高可滚 |
| `--gen-control-h` | `36px` | Tab、底栏控件、生成钮高度 |
| `--gen-control-radius` | `8px` | 全部控件圆角 |
| `--gen-cta-bg-ready` | `#f0f0f0` | 主 CTA 白底，无额外 box-shadow |
| `--gen-ref-thumb-size` | `37px` | 500px 宽内均匀 **11** 个完整缩略图 |
| `--gen-ref-thumb-gap` | `4px` | 参考条间距 |

---

## 3. 分区规范

### 3.1 顶栏（创作模式 Tab / 快捷操作）

- 横向 Tab：`min-height 36px`，`border-radius 8px`，solid 边框 `#4d4d4d`
- 右侧：展开等 **28×28** icon 钮，同样 8px 圆角
- Tab 顺序向 LibTV 靠拢（视频）：文生视频 · 全能参考 · 图生视频 · 首尾帧 · 图片参考

### 3.2 参考图条（仅有上游素材时渲染）

**禁止**无参考时的「暂无参考图」占位。

| 项 | 规范 |
|----|------|
| 布局 | 与顶栏 Tab **左对齐**；`mmThumbsScrollZone` **无**独立背景/边框/水平 padding |
| 缩略图 | 白卡片 `#fff` + 浅描边；`object-fit: cover` 铺满；右上序号 badge |
| 尺寸 | 37×37px，gap 4px，radius 8px |
| 渐变 | **隐藏左侧** `::before` 渐隐（左对齐后常驻会脏边）；右侧 `::after` 用 `var(--gen-panel-bg)` |
| 语义 | 合规蓝勾 **不在** thumb 上；仅在 prompt `@图N` pill 上（Seedance 自动合规） |
| 悬停 | 单一大图 portal，锚定在 thumb 上方；禁止双浮层 |

### 3.3 提示词 / 输入区

- 输入区 **无外描边**，与面板同色
- 行内 `@图N` pill（视频）：高 **18px**，thumb **14×14**（紧凑 **9×9**），pill radius **6px**；文字 11px
- 图片 `#风格` / 文本 `@引用`：可无 thumb；若未来需要媒体 pill，复用 `VideoPromptRefChip` + `mention-pill-thumb-media` 重置（清掉全局 `.nodeThumb` 的 margin / contain）

### 3.4 底栏

- 左：模型选择（Portal 菜单）
- 中：输出参数（视频外露比例+时长，其余进 Popover）
- 右：**36×36** 生成钮，8px 圆角，ready `#f0f0f0`
- 全部底栏控件 **8px 圆角**，禁止 capsule

---

## 4. 常见问题与修复模式

| 现象 | 根因 | 修复 |
|------|------|------|
| 参考条左侧发灰渐变 | `mmThumbsScrollZone::before` 常驻 | scoped 下 `display: none` |
| 参考条与 Tab 不对齐 | ScrollZone 水平 padding + 暗底盒子 | padding 改 `4px 0`；background transparent |
| 面板里一块更深/更浅 | 子区用 `#1f1f1f` / `rgba(0,0,0,.28)` | 统一 `--gen-panel-bg` |
| 底栏胶囊、顶栏方角 | `--*-control-radius-pill: 999px` | 改为 `var(--*-control-radius-square)` |
| pill 小图下半黑 | 全局 `.nodeThumb` margin + contain | pill 内 `margin:0; object-fit:cover; max-height:none` |
| 缩略图底部留白 | thumb 用 contain | 条带内统一 **cover** |

---

## 5. 各面板落地对照

| 面板 | 类名 | 参考条 | @ 媒体 pill | 状态轨 / 生成中 | 壳 bg/pad |
|------|------|--------|-------------|-----------------|-----------|
| 视频 ✅ | `videoGenPanel--chrome` | 完整实现 | `video-prompt-mention` | ✅ | 真源 |
| 图片 ✅ 🏁 | `imageGenPanel--minimal` | ✅ `ImageRefThumbStrip`（106） | ✅ `image-prompt-mention`（108） | ✅ 109/110 | ✅ `--gen-panel-*` |
| 文本/脚本 | `textGenPanel--chrome` | i2p 区独立 thumb | 通用 Mention | — | 应对齐 |
| 音频 | `audioTtsPanel--chrome` | 无 | 无 | — | 应对齐 |
| 合成 | `ffmpegConcatPanel--chrome` | clip 列表（非 ref strip） | 无 | — | 应对齐 |

**有上游参考 + @ 闭环的节点**（视频、图片）须复制 §3.2 + §3.3 媒体 pill 全套；其余节点至少对齐 §2 壳层 + §3.4 底栏。

---

## 6. 实施检查清单（新面板 / 改版）

- [ ] 500px 宽、`12px 14px 14px` padding、`#2b2b2b` 背景
- [ ] `--*-control-radius-pill` = `--*-control-radius-square` = 8px
- [ ] 生成钮 36px、8px 圆角、`#f0f0f0` ready，无多余 shadow
- [ ] 若用 `mmThumbsScrollZone`：无左渐变、无独立暗底、37px thumb
- [ ] 若用 inline 媒体 pill：专用 class 覆盖 `.nodeThumb` 全局样式
- [ ] 改 UI 后更新 `canvas-node-chrome-spec.md` 对应 §6

---

## 7. 参考文件

| 文件 | 内容 |
|------|------|
| `VideoGenerationPanel.css` | VGP token + 参考条 + 底栏 |
| `MinimalVideoNode.css` | 节点壳 / 预览 / 播放器 |
| `VideoMultimodalInputPanel.tsx` | 三区段结构 |
| `MentionInput.css` | `.video-prompt-mention--compact` |
| `VideoPromptRefChip.tsx` | 媒体 pill 组件 |
| `videoPromptPillLayout.ts` | pill 密度与宽度估算 |
| `nodeChromeTokens.css` | `--gen-panel-*` 共享 token |
| `docs/product/VIDEO_PANEL_LIBTV_OPTIMIZATION.md` | 产品级 LibTV 路线图 |
