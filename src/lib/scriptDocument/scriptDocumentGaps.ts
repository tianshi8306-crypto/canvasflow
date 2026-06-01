export type ScriptDocumentGapSeverity = "block" | "warn" | "info";

export type ScriptDocumentGap = {
  id: string;
  severity: ScriptDocumentGapSeverity;
  message: string;
};

export type ScriptDocumentAnalysis = {
  charCount: number;
  lineCount: number;
  estimatedSceneMarkers: number;
  gaps: ScriptDocumentGap[];
  /** 导入时写入节点的正文（可能被截断） */
  importText: string;
  truncated: boolean;
};

const MAX_IMPORT_CHARS = 48_000;

const SCENE_MARKERS =
  /(?:第\s*[一二三四五六七八九十百\d]+\s*场)|(?:场\s*\d+)|(?:INT\.|EXT\.|内景|外景)|(?:【[^】]{1,12}】)/gi;

const DIALOGUE_HINT = /[「」""『』]|(?:说[:：]|对白[:：])/;

export function analyzeScriptDocument(text: string): ScriptDocumentAnalysis {
  const raw = text.replace(/\r\n/g, "\n").trim();
  const charCount = raw.length;
  const lines = raw.split("\n");
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  const lineCount = lines.length;

  const gaps: ScriptDocumentGap[] = [];

  if (charCount < 80) {
    gaps.push({
      id: "too_short",
      severity: "block",
      message: "正文过短（不足 80 字），难以解析为镜头表",
    });
  }

  if (charCount > MAX_IMPORT_CHARS) {
    gaps.push({
      id: "too_long",
      severity: "warn",
      message: `正文约 ${charCount.toLocaleString()} 字，将截断至 ${MAX_IMPORT_CHARS.toLocaleString()} 字后导入`,
    });
  }

  const sceneMatches = raw.match(SCENE_MARKERS) ?? [];
  const estimatedSceneMarkers = sceneMatches.length;
  if (charCount >= 200 && estimatedSceneMarkers === 0) {
    gaps.push({
      id: "no_scene_markers",
      severity: "info",
      message: "未检测到明显场次/场景标记（如「第1场」「内景」），解析可能依赖 LLM 推断",
    });
  }

  if (charCount >= 300 && !DIALOGUE_HINT.test(raw)) {
    gaps.push({
      id: "no_dialogue_hint",
      severity: "info",
      message: "未检测到对白标记（引号、「说：」等），角色台词可能较弱",
    });
  }

  const emptyRatio =
    lineCount > 0 ? (lineCount - nonEmptyLines.length) / lineCount : 0;
  if (lineCount > 20 && emptyRatio > 0.45) {
    gaps.push({
      id: "sparse_lines",
      severity: "warn",
      message: "空行比例较高，建议合并段落后再解析",
    });
  }

  const truncated = charCount > MAX_IMPORT_CHARS;
  const importText = truncated ? raw.slice(0, MAX_IMPORT_CHARS) : raw;

  if (gaps.length === 0 && charCount >= 80) {
    gaps.push({
      id: "ready",
      severity: "info",
      message: `约 ${estimatedSceneMarkers || "若干"} 处场景标记 · ${nonEmptyLines.length} 行有效正文，可导入解析`,
    });
  }

  return {
    charCount,
    lineCount,
    estimatedSceneMarkers,
    gaps,
    importText,
    truncated,
  };
}

export function scriptDocumentGapSummary(analysis: ScriptDocumentAnalysis): string {
  const top = analysis.gaps.find((g) => g.severity === "block") ?? analysis.gaps[0];
  return top?.message ?? "剧本已就绪";
}
