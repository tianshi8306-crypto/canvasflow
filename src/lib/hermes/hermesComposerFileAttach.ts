import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  parseModelApiConfigFile,
  type ModelApiConfigFileParseResult,
} from "@/lib/hermes/agent/hermesModelApiConfigFile";
import { analyzeScriptDocument, type ScriptDocumentAnalysis } from "@/lib/scriptDocument/scriptDocumentGaps";
import {
  extractScriptDocument,
  type ScriptDocumentExtract,
} from "@/lib/scriptDocument/importScriptDocument";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";

export const HERMES_COMPOSER_FILE_EXTENSIONS = [
  "txt",
  "md",
  "markdown",
  "docx",
  "env",
  "json",
] as const;

export type HermesComposerFileKind = "script" | "model-config";

export type HermesComposerFileAttachResult =
  | { kind: "script"; extract: ScriptDocumentExtract; analysis: ScriptDocumentAnalysis }
  | { kind: "model-config"; parsed: ModelApiConfigFileParseResult };

export function classifyHermesComposerFileName(fileName: string): HermesComposerFileKind | null {
  const lower = fileName.trim().toLowerCase();
  const base = lower.split(/[/\\]/).pop() ?? lower;
  if (base === ".env" || base.endsWith(".env.local")) return "model-config";
  if (base.endsWith(".json")) return "model-config";
  if (/\.(txt|md|markdown|docx)$/.test(base)) return "script";
  if (base.endsWith(".env")) return "model-config";
  return null;
}

export function isHermesComposerSupportedFileName(fileName: string): boolean {
  return classifyHermesComposerFileName(fileName) !== null;
}

export function hermesComposerAttachFilterLabel(): string {
  return "剧本 · 模型配置";
}

async function readLocalTextFile(absPath: string): Promise<string> {
  const b64 = await invoke<string>("read_file_as_base64", { path: absPath });
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function charCount(text: string): number {
  return [...text].length;
}

async function extractScriptFromFile(file: File): Promise<ScriptDocumentExtract> {
  const fileName = file.name;
  const kind = classifyHermesComposerFileName(fileName);
  if (kind !== "script") {
    throw new Error(`不支持的剧本格式：${fileName}`);
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx")) {
    if (!isTauri()) throw new Error(DESKTOP_SHELL_HINT);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!);
    }
    const dataBase64 = btoa(binary);
    return invoke<ScriptDocumentExtract>("extract_script_document_bytes", {
      fileName,
      dataBase64,
    });
  }
  const text = await file.text();
  const format = lower.endsWith(".markdown")
    ? "markdown"
    : lower.endsWith(".md")
      ? "md"
      : "txt";
  return {
    fileName,
    format,
    text,
    charCount: charCount(text),
  };
}

async function parseModelConfigFromFile(file: File): Promise<ModelApiConfigFileParseResult> {
  const content = await file.text();
  return parseModelApiConfigFile(content, file.name);
}

export async function pickHermesComposerFilePath(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: hermesComposerAttachFilterLabel(),
        extensions: [...HERMES_COMPOSER_FILE_EXTENSIONS],
      },
    ],
  });
  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export async function attachHermesComposerFileFromPath(
  absPath: string,
): Promise<HermesComposerFileAttachResult> {
  const fileName = absPath.split(/[/\\]/).pop() ?? absPath;
  const kind = classifyHermesComposerFileName(fileName);
  if (!kind) {
    throw new Error(
      `不支持的格式「${fileName}」，请使用 .txt / .md / .docx / .env / .json`,
    );
  }
  if (kind === "model-config") {
    const content = await readLocalTextFile(absPath);
    return { kind, parsed: parseModelApiConfigFile(content, fileName) };
  }
  const extract = await extractScriptDocument(absPath);
  const analysis = analyzeScriptDocument(extract.text);
  return { kind, extract, analysis };
}

export async function attachHermesComposerFileFromBlob(
  file: File,
): Promise<HermesComposerFileAttachResult> {
  const kind = classifyHermesComposerFileName(file.name);
  if (!kind) {
    throw new Error(
      `不支持的格式「${file.name}」，请使用 .txt / .md / .docx / .env / .json`,
    );
  }
  if (kind === "model-config") {
    return { kind, parsed: await parseModelConfigFromFile(file) };
  }
  const extract = await extractScriptFromFile(file);
  const analysis = analyzeScriptDocument(extract.text);
  return { kind, extract, analysis };
}

export async function pickAndAttachHermesComposerFile(): Promise<HermesComposerFileAttachResult | null> {
  if (!isTauri()) return null;
  const path = await pickHermesComposerFilePath();
  if (!path) return null;
  return attachHermesComposerFileFromPath(path);
}

export function firstSupportedComposerPasteFile(files: FileList | File[]): File | null {
  const list = Array.from(files);
  return list.find((f) => isHermesComposerSupportedFileName(f.name)) ?? null;
}
