/**
 * 生成软著材料：操作说明书 Word + 源代码 Word（前30页 + 后30页）
 * 用法：node scripts/generate-softcopyright-docs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  PageNumber,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "软著");

const SOFTWARE_NAME = "CanvasFlow AI Studio";
const VERSION = "V0.5.0";
const HEADER_TEXT = `${SOFTWARE_NAME} ${VERSION}`;
const LINES_PER_PAGE = 50;
const PAGES_EACH = 30;

/** 软著源代码：按业务链路排序的核心源文件（排除测试） */
const SOURCE_FILES = [
  "src/main.tsx",
  "src/App.tsx",
  "src/components/FlowCanvas.tsx",
  "src/store/projectStore.ts",
  "src/lib/types.ts",
  "src/lib/nodeAnchorMenus.ts",
  "src/components/LeftAddDock.tsx",
  "src/components/nodes/TextNode.tsx",
  "src/components/nodes/TextComposerPanel.tsx",
  "src/components/nodes/MinimalScriptNode.tsx",
  "src/components/ScriptNodeFullscreenOverlay.tsx",
  "src/components/nodes/MinimalImageNode.tsx",
  "src/components/nodes/MinimalVideoNode.tsx",
  "src/components/nodes/MinimalAudioNode.tsx",
  "src/components/nodes/MinimalFFmpegNode.tsx",
  "src/components/compose/ComposeEditorOverlay.tsx",
  "src/components/hermes/HermesSidebar.tsx",
  "src/components/SettingsPanel.tsx",
  "src-tauri/src/main.rs",
  "src-tauri/src/lib.rs",
  "src-tauri/src/executor/engine.rs",
  "src-tauri/src/executor/graph_flow.rs",
  "src-tauri/src/executor/hermes_agent.rs",
  "src-tauri/src/executor/script_node.rs",
  "src-tauri/src/executor/script_parse.rs",
  "src-tauri/src/executor/llm.rs",
  "src-tauri/src/executor/ffmpeg.rs",
  "src-tauri/src/compose_concat.rs",
  "src-tauri/src/dreamina_gen.rs",
  "src-tauri/src/dreamina_cli.rs",
  "src-tauri/src/graph.rs",
  "src-tauri/src/settings.rs",
  "src-tauri/src/commands/project_cmd.rs",
  "src-tauri/src/commands/timeline_cmd.rs",
  "src-tauri/src/vault.rs",
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readLines(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.warn(`[skip] missing: ${relPath}`);
    return [];
  }
  const raw = fs.readFileSync(abs, "utf8");
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  return lines.map((line) => line.replace(/\t/g, "    "));
}

function collectAllSourceLines() {
  const all = [];
  for (const rel of SOURCE_FILES) {
    const lines = readLines(rel);
    if (lines.length === 0) continue;
    all.push(`/* ========== ${rel} ========== */`);
    all.push(...lines);
    all.push("");
  }
  while (all.length > 0 && all[all.length - 1] === "") all.pop();
  return all;
}

function chunkPages(lines) {
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  return pages;
}

function codeParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { line: 240, before: 0, after: 0 },
    children: [
      new TextRun({
        text: text === "" ? " " : text,
        font: "Courier New",
        size: 18,
        ...options,
      }),
    ],
  });
}

function makePageHeader() {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: HEADER_TEXT, font: "宋体", size: 18 })],
      }),
    ],
  });
}

function makePageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "第 ", font: "宋体", size: 18 }),
          new TextRun({ children: [PageNumber.CURRENT], font: "宋体", size: 18 }),
          new TextRun({ text: " 页", font: "宋体", size: 18 }),
        ],
      }),
    ],
  });
}

function buildSourceSectionParagraphs(pageLines, { title }) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [new TextRun({ text: title, font: "黑体", size: 28, bold: true })],
    }),
  ];
  for (const page of pageLines) {
    const padded = [...page];
    while (padded.length < LINES_PER_PAGE) padded.push("");
    for (const line of padded) {
      children.push(codeParagraph(line));
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return children;
}

async function generateSourceDocx(allLines) {
  const pages = chunkPages(allLines);
  const need = PAGES_EACH * 2;
  if (pages.length < need) {
    throw new Error(
      `源代码仅 ${pages.length} 页（${allLines.length} 行），不足软著要求的 ${need} 页。请补充 SOURCE_FILES。`,
    );
  }

  const frontPages = pages.slice(0, PAGES_EACH);
  const backPages = pages.slice(-PAGES_EACH);

  const body = [
    ...buildSourceSectionParagraphs(frontPages, {
      title: `${SOFTWARE_NAME} 源程序（前连续 ${PAGES_EACH} 页）`,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 400 },
      children: [
        new TextRun({
          text: "—— 以下为源程序后连续 30 页 ——",
          font: "黑体",
          size: 24,
          bold: true,
        }),
      ],
    }),
    ...buildSourceSectionParagraphs(backPages, {
      title: `${SOFTWARE_NAME} 源程序（后连续 ${PAGES_EACH} 页）`,
    }),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Courier New", size: 18 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 },
          },
        },
        headers: { default: makePageHeader() },
        footers: { default: makePageFooter() },
        children: body,
      },
    ],
  });

  const outPath = path.join(OUT_DIR, "CanvasFlow-AI-Studio-源代码.docx");
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ 源代码 Word：${outPath}`);
  console.log(`  总源程序 ${pages.length} 页 / ${allLines.length} 行；已提取前 ${PAGES_EACH} + 后 ${PAGES_EACH} 页`);

  const txtFront = path.join(OUT_DIR, "CanvasFlow-AI-Studio-源代码-前30页.txt");
  const txtBack = path.join(OUT_DIR, "CanvasFlow-AI-Studio-源代码-后30页.txt");
  fs.writeFileSync(
    txtFront,
    frontPages.map((p, i) => `--- 第 ${i + 1} 页 ---\n${p.join("\n")}`).join("\n\n"),
    "utf8",
  );
  fs.writeFileSync(
    txtBack,
    backPages.map((p, i) => `--- 第 ${i + 1} 页 ---\n${p.join("\n")}`).join("\n\n"),
    "utf8",
  );
  console.log(`✓ 源代码 TXT 备份：前30页、后30页`);
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparator(line) {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function mdToDocxChildren(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const children = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        inCode = false;
        for (const cl of codeBuf) {
          children.push(codeParagraph(cl, { font: "Consolas" }));
        }
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }
      i++;
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    if (line.trim() === "---") {
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 180 },
          children: [new TextRun({ text: line.slice(2).trim(), font: "黑体", size: 32, bold: true })],
        }),
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: line.slice(3).trim(), font: "黑体", size: 28, bold: true })],
        }),
      );
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 100 },
          children: [new TextRun({ text: line.slice(4).trim(), font: "黑体", size: 24, bold: true })],
        }),
      );
      i++;
      continue;
    }

    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseTableRow(line);
      i += 2;
      const rows = [header];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      const colCount = Math.max(...rows.map((r) => r.length));
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map(
          (row, ri) =>
            new TableRow({
              children: Array.from({ length: colCount }, (_, ci) => {
                const cellText = row[ci] ?? "";
                return new TableCell({
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1 },
                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                    left: { style: BorderStyle.SINGLE, size: 1 },
                    right: { style: BorderStyle.SINGLE, size: 1 },
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cellText,
                          font: "宋体",
                          size: 21,
                          bold: ri === 0,
                        }),
                      ],
                    }),
                  ],
                });
              }),
            }),
        ),
      });
      children.push(table);
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 420 },
          children: [
            new TextRun({ text: "• ", font: "宋体", size: 24 }),
            new TextRun({ text: line.trim().slice(2), font: "宋体", size: 24 }),
          ],
        }),
      );
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 420 },
          children: [new TextRun({ text: line.trim(), font: "宋体", size: 24 })],
        }),
      );
      i++;
      continue;
    }

    if (line.trim().startsWith(">")) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          indent: { left: 360 },
          children: [new TextRun({ text: line.trim().replace(/^>\s?/, ""), font: "宋体", size: 24, italics: true })],
        }),
      );
      i++;
      continue;
    }

    children.push(
      new Paragraph({
        spacing: { after: 100, line: 360 },
        children: [new TextRun({ text: line, font: "宋体", size: 24 })],
      }),
    );
    i++;
  }

  return children;
}

async function generateManualDocx() {
  const mdPath = path.join(OUT_DIR, "CanvasFlow-AI-Studio-软件操作说明书.md");
  if (!fs.existsSync(mdPath)) {
    throw new Error(`找不到说明书 Markdown：${mdPath}`);
  }
  const md = fs.readFileSync(mdPath, "utf8");
  const body = mdToDocxChildren(md);

  const cover = [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: SOFTWARE_NAME, font: "黑体", size: 44, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new TextRun({ text: "软件操作说明书", font: "黑体", size: 36, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [new TextRun({ text: `版本号：${VERSION}`, font: "宋体", size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      children: [new TextRun({ text: "2026 年 6 月", font: "宋体", size: 28 })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
          },
        },
        headers: { default: makePageHeader() },
        footers: { default: makePageFooter() },
        children: [...cover, ...body],
      },
    ],
  });

  const outPath = path.join(OUT_DIR, "CanvasFlow-AI-Studio-软件操作说明书.docx");
  const buf = await Packer.toBuffer(doc);
  const fallbacks = [
    path.join(OUT_DIR, "CanvasFlow-AI-Studio-软件操作说明书-V2.docx"),
    path.join(OUT_DIR, "CanvasFlow-AI-Studio-软件操作说明书-V2.1.docx"),
  ];
  try {
    fs.writeFileSync(outPath, buf);
    console.log(`✓ 操作说明书 Word：${outPath}`);
  } catch (err) {
    if (err && err.code === "EBUSY") {
      let written = false;
      for (const fallback of fallbacks) {
        try {
          fs.writeFileSync(fallback, buf);
          console.warn(`⚠ 主文件被占用，已写入：${fallback}`);
          written = true;
          break;
        } catch (e) {
          if (e?.code !== "EBUSY") throw e;
        }
      }
      if (!written) {
        throw new Error("操作说明书 Word 写入失败：主文件与备用文件名均被占用，请关闭 Word 后重试。");
      }
    } else {
      throw err;
    }
  }
}

async function main() {
  ensureDir(OUT_DIR);
  console.log(`生成软著材料 → ${OUT_DIR}\n`);

  const allLines = collectAllSourceLines();
  console.log(`已收集 ${allLines.length} 行源代码（${SOURCE_FILES.length} 个文件）\n`);

  await generateManualDocx();
  await generateSourceDocx(allLines);

  console.log("\n完成。请将 .docx 用 Word 打开检查排版，并按需插入界面截图。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
