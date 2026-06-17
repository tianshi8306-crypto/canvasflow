const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        VerticalAlign, PageNumber, PageBreak, TableOfContents } = require('docx');
const fs = require('fs');

// ========== Constants ==========
const border = { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" };
const borders = { top: border, bottom: border, left: border, right: border };
const pad = { top: 80, bottom: 80, left: 120, right: 120 };
const W = 9026; // A4 content width with 1" margins

// ========== Helpers ==========
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: t, font: "Microsoft YaHei", size: 32, bold: true })] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 140 }, children: [new TextRun({ text: t, font: "Microsoft YaHei", size: 26, bold: true })] });
const h3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 220, after: 100 }, children: [new TextRun({ text: t, font: "Microsoft YaHei", size: 23, bold: true })] });
const p = (t, o={}) => new Paragraph({ spacing: { before: 60, after: 60, line: 360 }, children: [new TextRun({ text: t, font: "Microsoft YaHei", size: 21, ...o })] });
const bullet = t => new Paragraph({ numbering: { reference: "bl", level: 0 }, spacing: { before: 40, after: 40, line: 340 }, children: [new TextRun({ text: t, font: "Microsoft YaHei", size: 21 })] });
const num = t => new Paragraph({ numbering: { reference: "nm", level: 0 }, spacing: { before: 40, after: 40, line: 340 }, children: [new TextRun({ text: t, font: "Microsoft YaHei", size: 21 })] });
const sp = () => new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun("")] });
const pb = () => new Paragraph({ children: [new PageBreak()] });

function note(text, type="info") {
  const m = { info: ["E8F0FE","提示"], warning: ["FFF4E5","注意"], tip: ["EDF7ED","技巧"] };
  const [bg, label] = m[type] || m.info;
  const para = new Paragraph({ spacing: { line: 340 }, children: [
    new TextRun({ text: label + "：", font: "Microsoft YaHei", size: 21, bold: true }),
    new TextRun({ text, font: "Microsoft YaHei", size: 21 })
  ]});
  const cell = new TableCell({ borders, width: { size: W, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 160, right: 160 },
    children: [para]
  });
  const row = new TableRow({ children: [cell] });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [row] });
}

function tbl(rows, cw) {
  if (!cw) {
    const cols = rows[0].length;
    cw = Array(cols).fill(Math.floor(W / cols));
    cw[0] += W - cw.reduce((a,b)=>a+b, 0);
  }
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: cw,
    rows: rows.map((row, i) => new TableRow({ children: row.map((cell, j) => new TableCell({
      borders, width: { size: cw[j], type: WidthType.DXA },
      shading: { fill: i===0 ? "2B5797" : (i%2===1 ? "F2F6FC" : "FFFFFF"), type: ShadingType.CLEAR },
      margins: pad,
      children: [new Paragraph({ children: [new TextRun({ text: cell, font: "Microsoft YaHei", size: 20, bold: i===0, color: i===0 ? "FFFFFF" : "333333" })] })]
    }))}))
  });
}

const step = (n, title, desc) => new Paragraph({ spacing: { before: 100, after: 80, line: 340 }, children: [
  new TextRun({ text: `${n}. `, font: "Microsoft YaHei", size: 21, bold: true, color: "2B5797" }),
  new TextRun({ text: title, font: "Microsoft YaHei", size: 21, bold: true }),
  new TextRun({ text: desc ? ("：" + desc) : "", font: "Microsoft YaHei", size: 21 })
]});

function featureCard(title, desc) {
  const p1 = new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: title, font: "Microsoft YaHei", size: 21, bold: true })] });
  const p2 = new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: desc, font: "Microsoft YaHei", size: 20, color: "555555" })] });
  const cell = new TableCell({ borders, width: { size: W, type: WidthType.DXA },
    shading: { fill: "F6F8FC", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 160, right: 160 },
    children: [p1, p2]
  });
  const row = new TableRow({ children: [cell] });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [row] });
}

// ========== Content ==========
const children = [

  // COVER
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 }, children: [new TextRun({ text: "CanvasFlow AI Studio", font: "Microsoft YaHei", size: 52, bold: true, color: "2B5797" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 160 }, children: [new TextRun({ text: "跨平台 AI 视频创作工具", font: "Microsoft YaHei", size: 32, color: "555555" })] }),
  sp(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 80 }, children: [new TextRun({ text: "软件操作说明书", font: "Microsoft YaHei", size: 30, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "Version 0.5.0", font: "Microsoft YaHei", size: 24, color: "666666" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "Apache-2.0 开源许可证", font: "Microsoft YaHei", size: 20, color: "888888" })] }),
  sp(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 0 }, children: [new TextRun({ text: "2026 年 06 月", font: "Microsoft YaHei", size: 20, color: "888888" })] }),
  pb(),

  // TOC
  h1("目录"),
  new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-2" }),
  pb(),

  // === CH1 ===
  h1("第1章  软件概述"),

  h2("1.1  软件简介"),
  p("CanvasFlow AI Studio 是一款融合无限画布、AI 创作灵体与节点工作流的跨平台桌面 AI 视频创作工具。用户可在无限画布上自由组织灵感，通过节点连线驱动 AI 自动生成剧本、分镜、图片和视频，最终一键导出成片。"),
  p("本工具基于 Tauri 2 框架构建，兼顾轻量级桌面体验与强大的 AI 多模态生成能力。"),
  sp(),

  h2("1.2  主要功能"),
  sp(),
  featureCard("无限画布", "基于 React Flow 实现，支持自由拖放、节点连线与分组，提供 6 种节点类型"),
  sp(),
  featureCard("AI 创作灵体 Hermes", "画布内置创作助手，支持自动执行与确认执行两种模式"),
  sp(),
  featureCard("节点工作流", "支持文本、图片、视频、脚本、剪辑、音频共 6 种节点"),
  sp(),
  featureCard("风格库", "内置风格预设，一键注入生成节点"),
  sp(),
  featureCard("多模态生成", "文生视频、图生视频、文生图、图生图、TTS 语音合成等"),
  sp(),
  featureCard("即梦 Seedance 2.0 集成", "深度集成字节跳动即梦平台，支持图片与视频高质量生成"),
  sp(),
  featureCard("FFmpeg 本地合成", "剪辑台 + 时间线，支持 BGM 叠加，一键导出成片"),
  sp(),
  featureCard("设置系统", "模型配置面板，API Key 安全存储于系统凭据管理器"),
  sp(),
  featureCard("本地工程管理", "目录式保存，含 canvasflow.json、assets 目录与 runs.db 数据库"),
  sp(),
  featureCard("自动更新", "集成 Tauri Updater，开箱即用的自动升级能力"),
  sp(),

  h2("1.3  适用范围"),
  bullet("个人创作者：快速将创意转化为分镜脚本和视频成品"),
  bullet("短视频团队：批量生成不同风格的营销视频内容"),
  bullet("AI 影视研究者：实验多模态 AI 生成管线，探索节点工作流的可能性"),
  bullet("教育与培训：可视化学习 AI 视频生成流程与节点编排逻辑"),
  sp(),

  h2("1.4  运行环境"),
  tbl([
    ["项目", "要求"],
    ["操作系统", "Windows 10/11（x64）、macOS 11+、Linux（Ubuntu 20.04+）"],
    ["处理器", "Intel Core i5 / Apple Silicon M1 及以上"],
    ["内存", "最低 8 GB RAM，推荐 16 GB"],
    ["存储", "至少 500 MB 可用空间，FFmpeg 合成需额外磁盘空间"],
    ["显卡", "GPU 加速可选，推荐 NVIDIA GPU 以提升生成效率"],
    ["网络", "需互联网连接以调用 AI API（OpenAI 兼容 API / 即梦 CLI）"],
    ["FFmpeg", "本地已安装 FFmpeg 并加入系统 PATH"]
  ]),
  sp(),
  note("首次使用前，请确保 FFmpeg 已安装并配置到系统 PATH 中，否则视频合成功能将无法使用。", "warning"),

  // === CH2 ===
  pb(),
  h1("第2章  安装与启动"),

  h2("2.1  下载与安装"),

  h3("2.1.1  Windows 系统"),
  step(1, "下载安装包", "访问 GitHub Release 页面，下载最新版本的 Windows 安装包（.msi 或 .exe）"),
  step(2, "运行安装程序", "双击安装包，按照安装向导提示完成安装"),
  step(3, "检查 FFmpeg", "首次运行前，确保 FFmpeg 已安装并添加至系统 PATH 环境变量"),
  sp(),
  note("安装完成后，建议在终端执行 ffmpeg -version 确认 FFmpeg 可正常使用。", "tip"),

  h3("2.1.2  macOS 系统"),
  step(1, "下载 .dmg 安装包"),
  step(2, "拖入应用程序", "打开 .dmg 文件，将 CanvasFlow AI Studio 拖入应用程序文件夹"),
  step(3, "允许运行", "首次启动时，需在系统偏好设置中允许运行来自非 App Store 的应用"),
  step(4, "解除隔离（可选）", "终端执行：xattr -d com.apple.quarantine /Applications/CanvasFlow\\ AI\\ Studio.app"),
  sp(),

  h3("2.1.3  Linux 系统"),
  step(1, "下载安装包", "下载 .AppImage 或 .deb 包"),
  step(2, "安装", "AppImage：chmod +x CanvasFlow*.AppImage && ./CanvasFlow*.AppImage；Deb：sudo dpkg -i canvasflow_*.deb"),
  step(3, "检查依赖", "确保系统已安装 GTK3 和 WebKitGTK"),
  sp(),

  h2("2.2  首次启动"),
  p("安装完成后启动 CanvasFlow AI Studio，软件将引导完成以下初始化："),
  num("设置工作区目录（工程文件的默认存储路径）"),
  num("配置 FFmpeg 路径（若未在系统 PATH 中检测到）"),
  num("在设置面板中配置 AI API Key"),
  num("完成初始化，进入主界面"),
  sp(),

  h2("2.3  界面总览"),
  p("主界面由以下区域组成："),
  sp(),
  featureCard("顶栏（TopBar）", "位于界面顶部，包含工程菜单、视图控制、Hermes 开关与设置入口"),
  sp(),
  featureCard("画布区（Canvas）", "中央主区域，基于 React Flow 渲染，用于放置节点、连线、缩放与平移"),
  sp(),
  featureCard("左侧面板（Left Panel）", "包含节点列表（+ 面板）和风格库入口，点击对应节点类型即可新建节点"),
  sp(),
  featureCard("Hermes 面板", "显示 AI 创作灵体 Hermes 的对话与执行状态"),

  // === CH3 ===
  pb(),
  h1("第3章  工程管理"),

  h2("3.1  新建工程"),
  step(1, "点击工程菜单", "点击顶栏「工程」菜单，选择「新建工程」"),
  step(2, "选择文件夹", "在弹出的文件选择器中，选择一个空的文件夹作为工程目录"),
  step(3, "自动初始化", "工程目录将自动创建 canvasflow.json 配置文件与 assets 子目录"),
  sp(),

  h2("3.2  打开工程"),
  step(1, "打开工程", "点击顶栏「工程」菜单，选择「打开工程」"),
  step(2, "选择文件夹", "选择包含 canvasflow.json 的文件夹，加载已有工程"),
  sp(),

  h2("3.3  保存工程"),
  h3("3.3.1  手动保存"),
  p("按 Ctrl+S（Windows/Linux）或 Cmd+S（macOS）保存工程。标签栏显示「未保存」圆点时提示需要保存。"),
  h3("3.3.2  自动保存"),
  p("软件默认每隔 5 分钟自动保存一次工程状态，有效防止因意外退出导致的工作丢失。"),
  note("重要操作（如批量导出）完成后，建议手动保存一次。", "warning"),
  sp(),

  h2("3.4  工程目录结构"),
  tbl([
    ["文件/目录", "类型", "说明"],
    ["canvasflow.json", "文件", "工程配置，存储画布布局、节点数据与工程元信息"],
    ["assets/", "目录", "资产目录，存放生成的图片、视频、音频等媒体文件"],
    ["runs.db", "文件", "SQLite 数据库，记录每次生成的元数据与状态"]
  ]),

  // === CH4 ===
  pb(),
  h1("第4章  画布操作基础"),

  h2("4.1  画布缩放与平移"),
  tbl([
    ["操作", "方法"],
    ["缩放", "鼠标滚轮"],
    ["平移", "按住鼠标中键拖拽，或按住空格键 + 鼠标左键拖拽"],
    ["画布全览", "按 Home 键"]
  ]),
  sp(),

  h2("4.2  创建节点"),
  p("有两种方式在画布上创建节点："),
  bullet("双击画布空白处，在弹出菜单中选择节点类型"),
  bullet("点击左侧「+」按钮，展开节点类型列表后选择"),
  sp(),
  note("支持创建的节点类型：文本、图片、视频、音频、脚本、剪辑，共 6 种。", "info"),

  h2("4.3  选中、拖动与删除节点"),
  tbl([
    ["操作", "方法"],
    ["选中", "单击节点"],
    ["多选", "按住 Shift 键单击，或框选"],
    ["拖动", "按住鼠标左键拖动至目标位置"],
    ["删除", "选中后按 Delete 或 Backspace"],
    ["编辑属性", "双击节点打开编辑面板"]
  ]),
  sp(),

  h2("4.4  连线操作"),
  bullet("连接：从节点输出端（右侧圆点）拖拽至目标节点输入端（左侧圆点）"),
  bullet("断开：单击连线，按 Delete 键删除"),
  bullet("循环检测：系统自动拦截会导致循环的连线"),
  sp(),
  note("连线代表数据流向，如文本节点连接图片节点，表示图片生成时使用该文本作为 prompt。", "tip"),

  h2("4.5  撤销与重做"),
  tbl([
    ["操作", "快捷键"],
    ["撤销", "Ctrl+Z / Cmd+Z"],
    ["重做", "Ctrl+Y 或 Ctrl+Shift+Z / Cmd+Shift+Z"]
  ]),

  // === CH5 ===
  pb(),
  h1("第5章  节点详解 — 文本节点"),

  h2("5.1  功能简介"),
  p("文本节点是工作流的基础单元，用于承载和展示文本信息。可以是用户手动输入的自然语言描述，也可以是 AI 模型生成的内容，作为下游节点的 prompt 来源。"),
  sp(),

  h2("5.2  创建方式"),
  bullet("双击画布空白处 → 选择「文本」"),
  bullet("点击左侧「+」→「文本」"),
  sp(),

  h2("5.3  文本输入与编辑"),
  p("文本节点内部提供编辑区，双击节点即可进入编辑模式，支持直接输入自由文本内容。"),
  sp(),

  h2("5.4  连接到下游节点"),
  p("文本节点作为工作流起点，通过输出端口（节点右侧小圆点）连接到下游节点，为 AI 生成提供 prompt。"),
  note("系统会检测并阻止形成死循环的连线配置。", "warning"),

  // === CH6 ===
  pb(),
  h1("第6章  节点详解 — 图片节点"),

  h2("6.1  功能简介"),
  p("图片节点用于承载和展示单张图片，来源可以是用户上传或 AI 图像模型生成。支持文生图、图生图两种模式，可从风格库注入风格预设。"),
  sp(),

  h2("6.2  创建方式"),
  bullet("双击画布空白处 → 选择「图片」"),
  bullet("点击左侧「+」→「图片」"),
  sp(),

  h2("6.3  生成模式"),
  h3("6.3.1  文生图（Text-to-Image）"),
  p("在编辑区输入文本 prompt，AI 根据文本描述生成对应图片。"),
  h3("6.3.2  图生图（Image-to-Image）"),
  p("基于输入图片，AI 在保持主体结构的基础上生成新图片。需要在节点输入端连接一个图片或文本节点以提供参考。"),
  sp(),

  h2("6.4  参考图引用"),
  p("支持在 prompt 中引用本地图片作为参考，生成的图片会展现在节点内部。"),
  sp(),

  h2("6.5  风格注入"),
  p("从风格库面板中选中一个风格预设，点击「注入」按钮，风格参数将自动填入图片节点的风格字段。注入后仍可在此基础上修改 prompt。"),
  note("风格注入仅影响生成效果，不会修改节点原有的 prompt 内容。", "tip"),

  // === CH7 ===
  pb(),
  h1("第7章  节点详解 — 视频节点"),

  h2("7.1  功能简介"),
  p("视频节点用于承载和展示单个视频，来源可以是用户上传或 AI 视频模型生成。支持文生视频、图生视频、首尾帧等多种模式，生成后视频自动保存至 assets 目录。"),
  sp(),

  h2("7.2  创建方式"),
  bullet("双击画布空白处 → 选择「视频」"),
  bullet("点击左侧「+」→「视频」"),
  sp(),

  h2("7.3  生成模式"),
  h3("7.3.1  文生视频（Text-to-Video）"),
  p("输入文本 prompt，AI 生成对应视频。"),
  h3("7.3.2  图生视频（Image-to-Video）"),
  p("上传一张图片，AI 基于图片内容生成动态视频。"),
  h3("7.3.3  首尾帧（First-Last Frame）"),
  p("同时提供首帧和尾帧图片，AI 生成从首帧过渡到尾帧的连续视频。"),
  sp(),

  h2("7.4  参数设置"),
  tbl([
    ["参数", "说明", "可选值", "默认值"],
    ["分辨率", "输出视频分辨率", "720p / 1080p", "720p"],
    ["时长", "单次生成视频时长", "根据模型不同", "5 秒"],
    ["模型", "视频生成模型", "即梦 Seedance 2.0 等", "即梦 Seedance 2.0"],
    ["运镜", "镜头运动方式", "推/拉/摇/移/跟/固定", "固定"]
  ], [1800, 2400, 2600, 2226]),
  sp(),

  h2("7.5  状态显示"),
  p("视频节点实时显示当前生成状态："),
  bullet("待机（灰色）：节点已创建，等待输入"),
  bullet("等待中（蓝色）：已提交生成请求，等待模型响应"),
  bullet("生成中（橙色）：正在生成，显示进度"),
  bullet("完成（绿色）：视频生成完毕，预览可用"),
  bullet("失败（红色）：生成出错，查看日志排查"),
  sp(),

  h2("7.6  工具栏操作"),
  bullet("提取音频：将视频中的音轨提取为独立音频文件，保存至 assets 目录"),
  bullet("裁剪：设置入点与出点，裁剪视频长度"),
  note("视频生成通常需要 1-5 分钟，建议生成期间不要关闭软件或切换工程。", "warning"),

  // === CH8 ===
  pb(),
  h1("第8章  节点详解 — 脚本节点"),

  h2("8.1  功能简介"),
  p("脚本节点支持用户通过描述剧情，或上传剧本/角色图像/参考视频，直接生成分镜脚本，并通过脚本批量生成分镜图像及视频。"),
  note("脚本节点是 AI 视频创作流程的核心枢纽，可将创意故事快速转化为可执行的分镜计划。", "info"),
  sp(),

  h2("8.2  创建方式"),
  bullet("双击画布空白处 → 选择「脚本」"),
  bullet("点击左侧「+」→「脚本」"),
  sp(),

  h2("8.3  分镜脚本表格"),
  p("脚本节点内部以表格形式存储分镜脚本数据，每一行代表一个镜头。"),
  sp(),

  h2("8.4  全屏编辑模式"),
  p("双击脚本节点，可将编辑区扩展为全屏模式，支持键盘导航和批量编辑。"),
  bullet("双击表格可修改内容"),
  bullet("支持上传角色图、风格参考（右键替换/删除）"),
  bullet("自定义列表：调整字段可见性、筛选画面，让脚本更直观简洁"),
  sp(),

  h2("8.5  AI 生成分镜"),
  step(1, "连接文本节点", "将文本节点连接到脚本节点的输入端口"),
  step(2, "触发生成", "点击「生成分镜」按钮"),
  step(3, "查看结果", "AI 生成分镜表，用户可手动调整每个镜头的描述"),
  sp(),

  h2("8.6  分镜表字段说明"),
  tbl([
    ["字段", "含义", "说明", "示例"],
    ["镜序", "Shot #", "镜头序号，从 1 递增", "1"],
    ["画面", "Visual", "镜头画面描述", "女孩走进咖啡馆"],
    ["运镜", "Camera", "运镜方式", "推"],
    ["对白", "Dialogue", "对白或旁白", "今天天气真好"],
    ["时长", "Duration", "镜头时长（秒）", "5s"],
    ["参考", "Ref", "参考图片或视频路径", "/assets/ref1.jpg"]
  ], [1500, 1400, 2600, 3526]),
  sp(),

  h2("8.7  导出分镜"),
  bullet("JSON 导出：将分镜数据导出为 JSON 文件"),
  bullet("CSV 导出：将分镜表导出为 CSV 格式"),
  note("导出数据可用于其他工具或备份，方便版本管理和协作。", "tip"),

  // === CH9 ===
  pb(),
  h1("第9章  节点详解 — 剪辑节点"),

  h2("9.1  功能简介"),
  p("剪辑节点是 CanvasFlow 视频创作闭环的核心。支持将多个视频片段拼接为完整视频，内置时间线编辑、BGM 叠加与 FFmpeg 导出功能。"),
  sp(),

  h2("9.2  创建方式"),
  bullet("双击画布空白处 → 选择「剪辑」"),
  bullet("点击左侧「+」→「剪辑」"),
  sp(),

  h2("9.3  剪辑台界面"),
  p("双击剪辑节点可打开剪辑台，分为三个区域："),
  bullet("视频预览区：实时预览当前编辑结果"),
  bullet("时间线编辑区：拖拽排序、裁剪视频片段"),
  bullet("工具栏：导出、添加 BGM、设置等操作"),
  sp(),

  h2("9.4  时间线操作"),

  h3("9.4.1  添加片段"),
  bullet("从其他节点的输出端口拖拽连线至剪辑节点，自动将视频/音频添加至时间线"),
  bullet("点击「添加片段」按钮，手动选择本地文件"),
  sp(),

  h3("9.4.2  删除片段"),
  p("在时间线上选中目标片段，按 Delete 键删除。"),
  sp(),

  h3("9.4.3  拖拽排序"),
  p("按住鼠标左键拖动时间线条目至目标位置，松开即完成排序。"),
  sp(),

  h3("9.4.4  裁剪片段"),
  p("将鼠标悬停在片段边缘，出现裁剪手柄后拖拽以调整入点/出点。"),
  sp(),

  h2("9.5  从脚本填充"),
  p("点击「从脚本填充」按钮，连接至脚本节点。系统自动解析分镜数据，按镜序顺序将每个镜头的输出视频填入时间线。"),
  note("此操作需要手动确认。建议填充前先确认每个镜头的视频文件已正确生成。", "warning"),
  sp(),

  h2("9.6  BGM 叠加"),
  bullet("点击「添加 BGM」按钮，选择本地音频文件"),
  bullet("BGM 轨道独立于视频轨道，可单独设置音量"),
  bullet("支持一键静音/取消静音"),
  sp(),

  h2("9.7  导出成片"),
  step(1, "确认时间线", "点击「导出成片」按钮"),
  step(2, "设置参数", "在弹出对话框中设置输出文件名、分辨率等"),
  step(3, "开始导出", "点击「开始导出」，FFmpeg 在后台执行本地拼接与编码"),
  step(4, "查看结果", "导出完成后，文件保存至工程 assets 目录"),
  note("FFmpeg 合成耗时取决于视频总时长和分辨率，导出过程中软件可能出现短暂卡顿，属正常现象。", "info"),

  // === CH10 ===
  pb(),
  h1("第10章  节点详解 — 音频节点"),

  h2("10.1  功能简介"),
  p("音频节点用于承载和展示单个音频，来源可以是用户上传或 AI 语音合成模型生成。支持本地音频导入和 TTS 文字转语音两种模式。"),
  sp(),

  h2("10.2  创建方式"),
  bullet("双击画布空白处 → 选择「音频」"),
  bullet("点击左侧「+」→「音频」"),
  sp(),

  h2("10.3  音频导入"),
  p("支持直接从画布外拖入音频文件，或点击「上传」按钮选择本地音频。"),
  sp(),

  h2("10.4  TTS 语音合成"),
  step(1, "输入文本", "在音频节点中输入需要转换为语音的文字"),
  step(2, "选择模型", "选择 TTS 合成模型"),
  step(3, "设置参数", "可设置语速、音调、音量等参数"),
  step(4, "生成音频", "点击「生成」，AI 将文本合成为语音并保存至 assets 目录"),
  note("TTS 合成的音频可与剪辑节点配合，为视频添加旁白或背景音乐。", "tip"),

  // === CH11 ===
  pb(),
  h1("第11章  AI 创作灵体 Hermes"),

  h2("11.1  功能简介"),
  p("Hermes 是画布内置的 AI 创作灵体，可以在无限画布中感知上下文、自动串联节点、监听事件并自主执行创作任务。它深度集成在 CanvasFlow 的节点系统中，可直接操作画布上的节点和连接。"),
  sp(),

  h2("11.2  执行模式"),
  tbl([
    ["模式", "说明"],
    ["自动执行", "Hermes 直接执行任务，无需用户确认"],
    ["确认执行", "Hermes 生成执行计划，等待用户确认后再执行"]
  ]),
  sp(),

  h2("11.3  核心能力"),
  bullet("感知画布：监听节点变更、连线变化和事件广播"),
  bullet("意图执行：解析用户自然语言指令，自动编排工作流"),
  bullet("自动串联：根据上下文自动在相关节点间建立连接"),
  bullet("任务编排：将复杂创作任务拆解为多个子任务，依次执行"),
  sp(),

  h2("11.4  启用与交互"),
  p("点击顶栏中的 Hermes 开关，即可开启 Hermes 面板。在面板中输入自然语言指令，Hermes 将自动规划并执行对应的节点工作流。"),
  note("Hermes 需要网络连接以调用 AI 语言模型 API，请确保在设置中已配置有效的 API Key。", "warning"),

  // === CH12 ===
  pb(),
  h1("第12章  风格库"),

  h2("12.1  功能简介"),
  p("风格库提供丰富的风格模板库，涵盖多种视觉表现类型。选择风格后，生成的作品将自动应用该风格。风格预设可与自定义 prompt 叠加使用，实现风格与内容的灵活组合。"),
  sp(),

  h2("12.2  使用方式"),
  step(1, "打开风格库", "点击画布左侧的「风格库」入口"),
  step(2, "浏览选择", "支持分类浏览与关键词搜索"),
  step(3, "应用风格", "点击选择风格，风格标签会被加载到当前选中节点的生成器中"),
  step(4, "完善 prompt", "按需完善画面 prompt，点击「生成」"),
  sp(),

  h2("12.3  风格分类"),
  bullet("摄影写真：真实感摄影风格"),
  bullet("电商营销：适合商业展示的视觉风格"),
  bullet("动漫游戏：二次元、卡通风格"),
  bullet("风格插画：水墨、油画、水彩等艺术风格"),
  sp(),

  h2("12.4  风格注入节点"),
  p("在图片节点或视频节点中，点击「风格注入」按钮，可将风格库中选中的风格一键填入节点风格字段。风格注入仅影响生成效果，不会修改节点原有的 prompt 内容。"),

  // === CH13 ===
  pb(),
  h1("第13章  设置系统"),

  h2("13.1  设置面板"),
  p("点击顶栏「设置」图标，进入设置面板。"),
  sp(),

  h2("13.2  模型配置"),
  p("CanvasFlow 支持配置多种 AI 模型："),
  bullet("图像模型：文生图、图生图模型的 API 配置"),
  bullet("视频模型：文生视频、图生视频模型的 API 配置"),
  bullet("语言模型：Hermes AI 灵体使用的语言模型 API"),
  sp(),
  note("API Key 将安全存储于系统凭据管理器（keyring），不会以明文形式保存在配置文件中。", "warning"),

  h2("13.3  FFmpeg 配置"),
  p("如果 FFmpeg 未在系统 PATH 中，CanvasFlow 会提示手动配置 FFmpeg 路径。点击「浏览」按钮选择 ffmpeg.exe 所在位置。"),
  note("FFmpeg 路径设置错误会导致视频导出失败。建议先用 ffmpeg -version 确认安装正常。", "warning"),
  sp(),

  h2("13.4  工作区设置"),
  bullet("默认工作区：设置工程文件的默认存储路径"),
  bullet("自动保存间隔：调整自动保存频率（默认 5 分钟）"),
  bullet("导出质量：设置视频默认导出分辨率和码率"),
  sp(),

  h2("13.5  关于"),
  bullet("版本信息：查看当前版本"),
  bullet("检查更新：手动检查新版本"),
  bullet("开源许可：查看 Apache-2.0 许可证信息"),
  bullet("问题反馈：访问 GitHub Issues 提交问题或建议"),

  // === CH14 ===
  pb(),
  h1("第14章  快捷键"),

  h2("14.1  画布操作"),
  tbl([
    ["快捷键", "操作", "平台", "说明"],
    ["Ctrl+S", "保存工程", "Windows/Linux", "手动保存当前工程"],
    ["Ctrl+Z", "撤销", "Windows/Linux", "撤销上一步操作"],
    ["Ctrl+Y", "重做", "Windows/Linux", "重做已撤销的操作"],
    ["Ctrl+Shift+Z", "重做", "Windows/Linux", "等效 Ctrl+Y"],
    ["Delete", "删除节点/连线", "全平台", "删除选中的节点或连线"],
    ["Home", "画布全览", "全平台", "将视图重置为显示全部节点"],
    ["空格+拖拽", "平移画布", "全平台", "按住空格后拖拽鼠标左键"]
  ], [1800, 1800, 1800, 3626]),
  sp(),

  h2("14.2  节点操作"),
  tbl([
    ["快捷键", "操作", "平台", "说明"],
    ["Ctrl+C", "复制节点", "Windows/Linux", "复制选中节点（不保留连线）"],
    ["Ctrl+V", "粘贴节点", "Windows/Linux", "粘贴已复制的节点"],
    ["Ctrl+D", "创建副本", "Windows/Linux", "快速复制当前节点（保留连线）"],
    ["Shift+点击", "多选节点", "全平台", "按住 Shift 点击多选"],
    ["双击节点", "编辑节点", "全平台", "打开节点编辑面板"]
  ], [1800, 1800, 1800, 3626]),
  note("快捷键在鼠标聚焦画布区域时生效。焦点在输入框或面板中时可能被拦截。", "info"),

  // === CH15 ===
  pb(),
  h1("第15章  常见问题"),

  h2("15.1  视频生成失败"),
  p("可能原因及解决方案："),
  num("API Key 配置错误：检查设置中填写的 API Key 是否正确且有效"),
  num("网络连接问题：确认设备可正常访问 AI API 服务商"),
  num("请求超时：网络不稳定时可尝试降低分辨率"),
  num("模型不支持：该功能可能需要特定模型权限，尝试更换模型"),
  sp(),
  note("查看工程目录下的 runs.db 可获取详细错误信息。", "tip"),

  h2("15.2  FFmpeg 导出失败"),
  num("FFmpeg 未安装：在终端执行 ffmpeg -version 确认"),
  num("FFmpeg 不在 PATH：手动在设置中指定路径"),
  num("磁盘空间不足：清理后再试"),
  num("分辨率不支持：部分 FFmpeg 版本对特定分辨率编码有限制，尝试更换分辨率"),
  sp(),

  h2("15.3  画布加载缓慢"),
  num("节点数量过多：超过 100 个节点时可能影响性能，考虑分组"),
  num("资源文件过大：assets 目录中的大文件可能拖慢加载，建议定期清理"),
  num("工程损坏：尝试重新打开工程，或从自动备份中恢复"),
  sp(),

  h2("15.4  Hermes 无响应"),
  num("API Key 未配置：在设置中配置语言模型 API Key"),
  num("模型不支持：确认所用模型支持 Chat Completion 接口"),
  num("上下文过长：过长的对话可能导致响应变慢"),

  // === CH16 ===
  pb(),
  h1("第16章  更新与维护"),

  h2("16.1  自动更新"),
  p("CanvasFlow AI Studio 集成 Tauri Updater，支持自动检查和安装更新。"),
  step(1, "启动时自动检查新版本"),
  step(2, "有新版本时界面右下角弹出更新提示"),
  step(3, "点击「更新」按钮下载安装，软件自动重启"),
  sp(),

  h2("16.2  手动更新"),
  p("前往 GitHub Release 页面下载最新版本安装包，覆盖安装即可。"),
  sp(),

  h2("16.3  数据备份"),
  bullet("工程文件：定期将工程文件夹备份到云盘或外部存储"),
  bullet("资源文件：assets 目录中存放生成的媒体文件，建议定期归档"),
  bullet("数据库：runs.db 记录所有生成历史，是重要的元数据备份"),
  note("工程文件夹完全可移植，复制到其他设备上可直接打开使用。", "tip"),

  // === CH17 ===
  pb(),
  h1("第17章  工程备份与恢复"),

  h2("17.1  工程备份"),
  step(1, "关闭工程", "在 CanvasFlow 中关闭要备份的工程"),
  step(2, "复制文件夹", "将工程文件夹完整复制到备份位置"),
  step(3, "验证备份", "确认 canvasflow.json 和 assets 目录已包含在备份中"),
  sp(),

  h2("17.2  工程恢复"),
  step(1, "复制备份", "将备份的工程文件夹复制到目标设备"),
  step(2, "打开工程", "在 CanvasFlow 中点击「打开工程」，选择该文件夹"),
  step(3, "验证完整性", "检查所有节点和资源是否正常加载"),
  note("工程中使用本地路径的资源（如本地图片）在复制到其他设备后路径可能失效，需重新配置。", "warning"),

  // === CH18 ===
  pb(),
  h1("第18章  高级功能"),

  h2("18.1  节点分组"),
  p("对于复杂项目，可以将相关节点打组，方便管理和复用。"),
  step(1, "多选节点", "框选或 Shift+点击选中多个节点"),
  step(2, "创建组", "右键选择「打组」"),
  step(3, "命名组", "为组命名，方便识别"),
  step(4, "折叠组", "双击组标题可折叠/展开"),
  sp(),

  h2("18.2  工作流模板"),
  p("将常用的节点组合保存为工作流模板，下次使用时直接加载。"),
  step(1, "编排工作流", "在画布上搭建好节点组合"),
  step(2, "保存为模板", "右键组选择「创建工作流模板」"),
  step(3, "加载模板", "从「我的工具箱」中加载已保存的模板"),
  sp(),

  h2("18.3  runs.db 数据库"),
  p("工程目录下的 runs.db 是 SQLite 数据库，记录每次生成的详细元数据："),
  bullet("节点生成记录：生成时间、模型、参数和结果"),
  bullet("状态追踪：每个任务的实时状态（等待中/生成中/完成/失败）"),
  bullet("日志审计：所有操作均可追溯，方便排查和优化"),
  note("runs.db 可使用 SQLite 客户端（如 DB Browser for SQLite）直接打开查看。", "tip"),

  // === CH19 ===
  pb(),
  h1("第19章  参考信息"),

  h2("19.1  项目信息"),
  tbl([
    ["项目", "内容", "备注"],
    ["项目名称", "CanvasFlow AI Studio", ""],
    ["版本", "0.5.0", ""],
    ["许可证", "Apache-2.0", "开源免费使用"],
    ["代码仓库", "github.com/tianshi8306-crypto/canvasflow", "欢迎 Star 和 Issue"],
    ["技术框架", "Tauri 2 + React 18 + Rust", "跨平台桌面应用"]
  ]),
  sp(),

  h2("19.2  技术架构"),
  sp(),
  featureCard("前端（React 18 + TypeScript）", "无限画布渲染、节点 UI、状态管理、用户交互"),
  sp(),
  featureCard("状态管理（Zustand）", "画布节点状态、生成状态、UI 状态"),
  sp(),
  featureCard("AI 编排（xState）", "Hermes AI 灵体状态机、任务执行流"),
  sp(),
  featureCard("后端（Rust + Tauri）", "FFmpeg 调用、LLM API 调用、本地文件管理、凭据安全存储"),
  sp(),
  featureCard("存储", "canvasflow.json（配置）+ assets/（媒体）+ runs.db（SQLite）"),
  sp(),

  h2("19.3  支持的 AI 模型"),
  h3("图像模型"),
  bullet("即梦 Seedance 2.0（文生图 / 图生图）"),
  bullet("OpenAI DALL-E 系列（需配置 OpenAI API）"),
  bullet("其他兼容 OpenAI 图像 API 的服务商"),
  sp(),
  h3("视频模型"),
  bullet("即梦 Seedance 2.0（文生视频 / 图生视频）"),
  sp(),
  h3("语言模型"),
  bullet("OpenAI GPT 系列（用于 Hermes AI 灵体）"),
  bullet("其他兼容 OpenAI Chat API 的服务商"),
  note("如需使用特定模型，需在设置中配置对应的 API Key。部分模型可能需要额外申请访问权限。", "info"),

  h2("19.4  开源协议说明"),
  p("CanvasFlow AI Studio 采用 Apache-2.0 开源许可证："),
  bullet("允许商业使用"),
  bullet("允许修改分发"),
  bullet("使用时需保留原作者署名"),
  bullet("修改后需在分发时声明变更"),
  bullet("软件按「原样」提供，不承担任何担保责任"),
  sp(),

  h2("19.5  致谢与反馈"),
  p("如有问题或建议，欢迎通过以下方式反馈："),
  bullet("GitHub Issues：github.com/tianshi8306-crypto/canvasflow/issues"),
  bullet("功能请求：欢迎提交 Feature Request，共同完善工具"),
  sp(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 },
    children: [new TextRun({ text: "祝你创作愉快！", font: "Microsoft YaHei", size: 26, bold: true, color: "2B5797" })]
  }),
];

// ========== Build ==========
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Microsoft YaHei", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Microsoft YaHei", color: "2B5797" },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Microsoft YaHei", color: "2B5797" },
        paragraph: { spacing: { before: 300, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: "Microsoft YaHei", color: "333333" },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 } },
    ]
  },
  numbering: { config: [
    { reference: "bl", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 480, hanging: 240 } } } },
      { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 960, hanging: 360 } } } }
    ]},
    { reference: "nm", levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 480, hanging: 240 } } } }
    ]}
  ]},
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "CanvasFlow AI Studio 软件操作说明书", font: "Microsoft YaHei", size: 16, color: "AAAAAA" })]
    })]}) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "第 ", font: "Microsoft YaHei", size: 16, color: "AAAAAA" }),
        new TextRun({ children: [PageNumber.CURRENT], font: "Microsoft YaHei", size: 16, color: "AAAAAA" }),
        new TextRun({ text: " 页 / 共 ", font: "Microsoft YaHei", size: 16, color: "AAAAAA" }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Microsoft YaHei", size: 16, color: "AAAAAA" }),
        new TextRun({ text: " 页", font: "Microsoft YaHei", size: 16, color: "AAAAAA" })
      ]
    })]}) },
    children
  }]
});

const out = 'C:/Users/凡/.qclaw/workspace/CanvasFlow_AI_Studio_软件操作说明书_v2.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(out, buf);
  console.log('OK:', out, buf.length, 'bytes');
}).catch(e => console.error('ERR:', e));
