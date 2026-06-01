import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import {
  applyModelApiConfigDrafts,
  inferModelApiLane,
  type ApplyModelApiConfigResult,
  type ModelApiLane,
  type ParsedModelApiDraft,
} from "@/lib/hermes/agent/hermesModelApiConfig";

export type ModelApiConfigFileParseResult = {
  fileName: string;
  format: "env" | "json";
  drafts: ParsedModelApiDraft[];
  warnings: string[];
};

const LANE_ALIASES: Record<string, ModelApiLane> = {
  chat: "chat",
  llm: "chat",
  text: "chat",
  openai: "chat",
  image: "image",
  img: "image",
  seedream: "image",
  video: "video",
  vid: "video",
  seedance: "video",
  audio: "audio",
  tts: "audio",
  speech: "audio",
  voice: "audio",
};

function laneLabel(lane: ModelApiLane): string {
  switch (lane) {
    case "chat":
      return "对话";
    case "image":
      return "图片";
    case "video":
      return "视频";
    case "audio":
      return "语音";
  }
}

function normalizeEnvValue(raw: string): string {
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

function laneFromEnvKey(key: string): ModelApiLane | null {
  const k = key.toUpperCase();
  if (/^(IMAGE|IMG|SEEDREAM)_/.test(k)) return "image";
  if (/^(VIDEO|VID|SEEDANCE)_/.test(k)) return "video";
  if (/^(AUDIO|TTS|SPEECH|VOICE)_/.test(k)) return "audio";
  if (/^(CHAT|LLM|TEXT|OPENAI|GPT)_/.test(k)) return "chat";
  return null;
}

function laneFromSectionHeader(line: string): ModelApiLane | null {
  const m = line.match(/^\[(.+?)\]\s*$/) ?? line.match(/^#\s*(.+?)\s*$/);
  if (!m?.[1]) return null;
  const token = m[1].trim().toLowerCase().replace(/\s+/g, "");
  for (const [alias, lane] of Object.entries(LANE_ALIASES)) {
    if (token.includes(alias)) return lane;
  }
  return inferModelApiLane(m[1]);
}

function pickFromVars(
  vars: Record<string, string>,
  patterns: RegExp[],
): string | undefined {
  for (const [key, value] of Object.entries(vars)) {
    const k = key.toUpperCase();
    if (patterns.some((re) => re.test(k)) && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function draftFromVars(
  vars: Record<string, string>,
  laneHint?: ModelApiLane,
): ParsedModelApiDraft | null {
  if (Object.keys(vars).length === 0) return null;

  let lane = laneHint ?? null;
  if (!lane) {
    for (const key of Object.keys(vars)) {
      const fromKey = laneFromEnvKey(key);
      if (fromKey) {
        lane = fromKey;
        break;
      }
    }
  }
  lane ??= inferModelApiLane(Object.values(vars).join("\n")) ?? "chat";

  const apiKey = pickFromVars(vars, [
    /API[_-]?KEY$/,
    /SECRET$/,
    /TOKEN$/,
    /ACCESS[_-]?TOKEN$/,
  ]);
  const baseUrl = pickFromVars(vars, [
    /BASE[_-]?URL$/,
    /API[_-]?URL$/,
    /ENDPOINT$/,
    /HOST$/,
  ]);
  const model = pickFromVars(vars, [/MODEL$/, /MODEL[_-]?ID$/, /MODEL[_-]?NAME$/]);
  const label = pickFromVars(vars, [/LABEL$/, /NAME$/]);

  if (!apiKey && !baseUrl && !model) return null;

  return {
    lane,
    apiKey,
    baseUrl,
    model,
    label,
  };
}

export function parseEnvModelApiConfig(content: string): ModelApiConfigFileParseResult {
  const warnings: string[] = [];
  const drafts: ParsedModelApiDraft[] = [];
  let sectionLane: ModelApiLane | undefined;
  let vars: Record<string, string> = {};

  const flush = () => {
    const draft = draftFromVars(vars, sectionLane);
    if (draft) drafts.push(draft);
    vars = {};
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) continue;

    const section = laneFromSectionHeader(line);
    if (section) {
      flush();
      sectionLane = section;
      continue;
    }

    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = normalizeEnvValue(line.slice(eq + 1));
    if (!key) continue;
    vars[key] = value;
  }

  flush();

  if (drafts.length === 0) {
    warnings.push("未在 .env 中识别到 API Key / 地址 / 模型字段");
  }

  return { fileName: "", format: "env", drafts, warnings };
}

function draftFromJsonObject(
  obj: Record<string, unknown>,
  laneHint?: ModelApiLane,
): ParsedModelApiDraft | null {
  const laneRaw = pickString(obj, ["lane", "type", "kind", "category"]);
  const lane =
    (laneRaw && LANE_ALIASES[laneRaw.toLowerCase()]) ||
    laneHint ||
    inferModelApiLane(JSON.stringify(obj)) ||
    "chat";

  const apiKey = pickString(obj, [
    "apiKey",
    "api_key",
    "key",
    "token",
    "accessToken",
  ]);
  const baseUrl = pickString(obj, [
    "baseUrl",
    "base_url",
    "apiBaseUrl",
    "api_base_url",
    "url",
    "endpoint",
  ]);
  const model = pickString(obj, ["model", "modelId", "model_id", "modelName"]);
  const label = pickString(obj, ["label", "name", "title"]);

  if (!apiKey && !baseUrl && !model) return null;

  return { lane, apiKey, baseUrl, model, label };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function draftsFromCanvasflowExport(
  root: Record<string, unknown>,
  keysMap: Record<string, string>,
): ParsedModelApiDraft[] {
  const drafts: ParsedModelApiDraft[] = [];

  const providers = root.providers;
  if (Array.isArray(providers)) {
    for (const item of providers.slice(0, 3)) {
      if (!item || typeof item !== "object") continue;
      const p = item as Record<string, unknown>;
      const draft = draftFromJsonObject(
        {
          lane: "chat",
          baseUrl: p.baseUrl,
          model: p.model,
          label: p.label,
          apiKey: keysMap[String(p.id ?? "")],
        },
        "chat",
      );
      if (draft) drafts.push(draft);
    }
  }

  const pushMedia = (
    lane: Exclude<ModelApiLane, "chat">,
    list: unknown,
    keyPrefix: string,
  ) => {
    if (!Array.isArray(list)) return;
    for (const item of list.slice(0, 2)) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      const id = String(m.id ?? "");
      const draft = draftFromJsonObject(
        {
          lane,
          baseUrl: m.apiBaseUrl,
          model: m.model,
          label: m.label,
          apiKey: keysMap[`${keyPrefix}${id}`],
        },
        lane,
      );
      if (draft) drafts.push(draft);
    }
  };

  pushMedia("image", root.imageModels, "image-model:");
  pushMedia("video", root.videoModels, "video-model:");
  pushMedia("audio", root.audioModels, "audio-model:");

  return drafts;
}

export function parseJsonModelApiConfig(content: string): ModelApiConfigFileParseResult {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      fileName: "",
      format: "json",
      drafts: [],
      warnings: ["JSON 解析失败，请检查文件格式"],
    };
  }

  const drafts: ParsedModelApiDraft[] = [];

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const draft = draftFromJsonObject(item as Record<string, unknown>);
      if (draft) drafts.push(draft);
    }
  } else if (parsed && typeof parsed === "object") {
    const root = parsed as Record<string, unknown>;
    const keysRaw = root.keys;
    const keysMap =
      keysRaw && typeof keysRaw === "object"
        ? Object.fromEntries(
            Object.entries(keysRaw as Record<string, unknown>).filter(
              ([, v]) => typeof v === "string",
            ) as [string, string][],
          )
        : {};

    if (root.providers || root.imageModels || root.videoModels || root.audioModels) {
      drafts.push(...draftsFromCanvasflowExport(root, keysMap));
    }

    if (drafts.length === 0) {
      for (const [key, lane] of Object.entries(LANE_ALIASES)) {
        const section = root[key];
        if (section && typeof section === "object") {
          const draft = draftFromJsonObject(section as Record<string, unknown>, lane);
          if (draft) drafts.push(draft);
        }
      }
    }

    if (drafts.length === 0) {
      const single = draftFromJsonObject(root);
      if (single) drafts.push(single);
    }
  }

  if (drafts.length === 0) {
    warnings.push("未在 JSON 中识别到 lane + apiKey/baseUrl/model 结构");
  }

  return { fileName: "", format: "json", drafts, warnings };
}

export function parseModelApiConfigFile(
  content: string,
  fileName: string,
): ModelApiConfigFileParseResult {
  const lower = fileName.toLowerCase();
  const result =
    lower.endsWith(".env") || lower.endsWith(".env.local")
      ? parseEnvModelApiConfig(content)
      : parseJsonModelApiConfig(content);
  return { ...result, fileName };
}

export function summarizeModelApiConfigFile(
  parsed: ModelApiConfigFileParseResult,
): string {
  if (parsed.drafts.length === 0) {
    return parsed.warnings[0] ?? "未解析到有效配置。";
  }
  const lanes = parsed.drafts.map((d) => laneLabel(d.lane));
  const unique = [...new Set(lanes)];
  const parts = [
    `已读取「${parsed.fileName}」`,
    `${parsed.format.toUpperCase()}`,
    `识别 ${parsed.drafts.length} 项（${unique.join("、")}）`,
  ];
  if (parsed.warnings.length > 0) parts.push(parsed.warnings[0]!);
  parts.push("尚未写入设置。可点下方「导入配置」确认。");
  return parts.filter(Boolean).join(" · ");
}

async function readLocalTextFile(absPath: string): Promise<string> {
  const b64 = await invoke<string>("read_file_as_base64", { path: absPath });
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export async function pickModelApiConfigFilePath(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "模型配置",
        extensions: ["env", "json"],
      },
    ],
  });
  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export async function pickAndParseModelApiConfigFile(): Promise<ModelApiConfigFileParseResult | null> {
  if (!isTauri()) return null;
  const path = await pickModelApiConfigFilePath();
  if (!path) return null;
  const content = await readLocalTextFile(path);
  const fileName = path.split(/[/\\]/).pop() ?? path;
  return parseModelApiConfigFile(content, fileName);
}

export async function applyModelApiConfigFile(
  drafts: ParsedModelApiDraft[],
): Promise<ApplyModelApiConfigResult> {
  return applyModelApiConfigDrafts(drafts);
}

export function isModelApiConfigFileIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /导入.*(模型)?配置|上传.*配置|导入\s*\.env|导入\s*json|配置文件/.test(t);
}

export async function messageForModelApiConfigFileIntent(
  text: string,
  pickFile: () => Promise<ModelApiConfigFileParseResult | null>,
): Promise<{ handled: boolean; message: string; parsed?: ModelApiConfigFileParseResult }> {
  if (!isModelApiConfigFileIntent(text)) {
    return { handled: false, message: "" };
  }
  if (!isTauri()) return { handled: true, message: DESKTOP_SHELL_HINT };
  const parsed = await pickFile();
  if (!parsed) return { handled: true, message: "已取消选择配置文件。" };
  if (parsed.drafts.length === 0) {
    return {
      handled: true,
      message: summarizeModelApiConfigFile(parsed),
      parsed,
    };
  }
  return {
    handled: true,
    message: summarizeModelApiConfigFile(parsed),
    parsed,
  };
}
