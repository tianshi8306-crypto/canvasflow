import type { ScriptBeat, ScriptRole } from "@/lib/types";
import { SHOT_TYPE_OPTIONS } from "@/lib/scriptBeatFieldNormalize";
import scriptEnums from "@/shared/config/script-enums.json";

export type ScriptBeatsTableVariant = "inline" | "fullscreen";

export type ScriptBeatStringKey = Exclude<keyof ScriptBeat, "characters">;
export type TableColKey =
  | ScriptBeatStringKey
  | "characters"
  | `roleName:${number}`
  | `roleDesc:${number}`
  | `roleImage:${number}`;
export type TableCol = { key: TableColKey; label: string; minW?: number };

export const TEXTAREA_KEYS = new Set<ScriptBeatStringKey>([
  "description",
  "dialogue",
  "storyboardBlock",
  "storyboardPrompt",
  "videoMotionPrompt",
]);

export function patchRow(rows: ScriptBeat[], idx: number, key: ScriptBeatStringKey, value: string): ScriptBeat[] {
  return rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r));
}

export function createEmptyScriptRole(): ScriptRole {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    imagePath: "",
    reference: "",
    action: "",
    emotion: "",
    lines: "",
  };
}

function legacyRoleFromBeat(beat: ScriptBeat, idx: number): ScriptRole | undefined {
  if (idx === 0) {
    const name = (beat.character1 ?? "").trim();
    const desc = (beat.character1Desc ?? "").trim();
    const image = (beat.character1Image ?? "").trim();
    if (!name && !desc && !image) return undefined;
    return {
      id: `legacy-role-${idx}`,
      name: beat.character1 ?? "",
      description: beat.character1Desc ?? "",
      imagePath: beat.character1Image ?? "",
      reference: "",
      action: beat.characterAction ?? "",
      emotion: beat.emotion ?? "",
      lines: beat.dialogue ?? "",
    };
  }
  if (idx === 1) {
    const name = (beat.character2 ?? "").trim();
    const desc = (beat.character2Desc ?? "").trim();
    const image = (beat.character2Image ?? "").trim();
    if (!name && !desc && !image) return undefined;
    return {
      id: `legacy-role-${idx}`,
      name: beat.character2 ?? "",
      description: beat.character2Desc ?? "",
      imagePath: beat.character2Image ?? "",
      reference: "",
      action: "",
      emotion: "",
      lines: "",
    };
  }
  return undefined;
}

/** 将 `characters[]` 写回 beat，并同步 character1/2 与对白等 legacy 列（表格角色图列与卡片一致） */
export function applyCharactersToBeat(beat: ScriptBeat, roles: ScriptRole[]): ScriptBeat {
  const r0 = roles[0];
  const r1 = roles[1];
  const dialogueFromRoles = roles
    .map((r) => (r.lines ?? "").trim())
    .filter(Boolean)
    .join("\n");
  return {
    ...beat,
    characters: roles,
    character1: r0?.name ?? "",
    character1Desc: r0?.description ?? "",
    character1Image: r0?.imagePath ?? "",
    character2: r1?.name ?? "",
    character2Desc: r1?.description ?? "",
    character2Image: r1?.imagePath ?? "",
    characterAction: r0?.action ?? beat.characterAction ?? "",
    emotion: r0?.emotion ?? beat.emotion ?? "",
    dialogue: dialogueFromRoles || (beat.dialogue ?? ""),
  };
}

export function getBeatRoles(beat: ScriptBeat): ScriptRole[] {
  const roles = beat.characters ?? [];
  if (roles.length > 0) return roles;
  const legacy: ScriptRole[] = [];
  const r0 = legacyRoleFromBeat(beat, 0);
  const r1 = legacyRoleFromBeat(beat, 1);
  if (r0) legacy.push(r0);
  if (r1) legacy.push(r1);
  return legacy;
}

export function summarizeScriptRoles(beat: ScriptBeat): string {
  const roles = getBeatRoles(beat).filter((r) => (r.name ?? "").trim() || (r.imagePath ?? "").trim());
  if (roles.length === 0) return "无角色";
  const first = roles[0]!;
  const head = (first.name ?? "").trim() || "未命名";
  return roles.length === 1 ? head : `${head} 等 ${roles.length} 人`;
}

export function patchRowCharacters(rows: ScriptBeat[], idx: number, roles: ScriptRole[]): ScriptBeat[] {
  return rows.map((r, i) => (i === idx ? applyCharactersToBeat(r, roles) : r));
}

export function serializeCharacters(roles: ScriptRole[] | undefined): string {
  return (roles ?? [])
    .map((r) =>
      [
        r.name ?? "",
        r.description ?? "",
        r.imagePath ?? "",
        r.action ?? "",
        r.emotion ?? "",
        r.lines ?? "",
      ].join(" | "),
    )
    .join("\n");
}

export function parseCharacters(text: string): ScriptRole[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", description = "", imagePath = "", action = "", emotion = "", lines = ""] = line
        .split("|")
        .map((s) => s.trim());
      return {
        id: crypto.randomUUID(),
        name,
        description,
        imagePath,
        reference: "",
        action,
        emotion,
        lines,
      } satisfies ScriptRole;
    })
    .filter((r) => r.name || r.description || r.lines);
}

export const ROLE_DESC_TEMPLATE_KEYS = [
  "基础身份",
  "面部特征",
  "服饰装备",
  "姿态与互动",
  "环境与风格",
] as const;

export function normalizeRoleDescTemplate(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) {
    return ROLE_DESC_TEMPLATE_KEYS.map((k) => `${k}：`).join("\n");
  }
  const lines = raw
    .split(/\n|；|;/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hit: Record<string, string> = {};
  for (const l of lines) {
    const m = l.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (m) {
      hit[m[1].trim()] = m[2].trim();
    }
  }
  return ROLE_DESC_TEMPLATE_KEYS.map((k) => `${k}：${hit[k] ?? ""}`).join("\n");
}

export function roleDescDisplayText(input: string): string {
  const normalized = normalizeRoleDescTemplate(input);
  return normalized
    .split("\n")
    .map((line) => {
      const m = line.match(/^([^:：]+)[:：]\s*(.*)$/);
      return (m?.[2] ?? "").trim();
    })
    .join("\n");
}

export function roleDescFromDisplayText(input: string): string {
  const vals = (input ?? "")
    .split("\n")
    .map((s) => s.trim());
  return ROLE_DESC_TEMPLATE_KEYS.map((k, i) => `${k}：${vals[i] ?? ""}`).join("\n");
}

export function normalizeRoleDescDisplayText(input: string): string {
  return roleDescDisplayText(roleDescFromDisplayText(input));
}

/** 全屏：结构化分镜字段（P0） */
export const SCRIPT_BEATS_FULLSCREEN_BASE_COLUMNS: TableCol[] = [
  { key: "shotNumber", label: "镜号", minW: 72 },
  { key: "sceneHeading", label: "场景", minW: 120 },
  { key: "durationHint", label: "时长", minW: 64 },
  { key: "shotSize", label: "景别", minW: 72 },
  { key: "cameraMove", label: "运镜", minW: 64 },
  { key: "description", label: "画面描述", minW: 180 },
  { key: "dialogue", label: "对白", minW: 140 },
  { key: "dialogueType", label: "对白类型", minW: 80 },
  { key: "performanceNote", label: "表演", minW: 72 },
  { key: "emotion", label: "情绪", minW: 72 },
  { key: "bgmHint", label: "BGM", minW: 100 },
  { key: "rhythmTag", label: "节奏", minW: 88 },
  { key: "soundHint", label: "声音", minW: 88 },
  { key: "editFocus", label: "剪辑", minW: 88 },
  { key: "storyboardPrompt", label: "Seedance 正向", minW: 140 },
  { key: "videoMotionPrompt", label: "Seedance 负向", minW: 140 },
];

export const INLINE_COLUMNS_WIDE: TableCol[] = [
  { key: "shotNumber", label: "镜号", minW: 58 },
  { key: "durationHint", label: "时长", minW: 72 },
  { key: "description", label: "画面描述", minW: 180 },
  { key: "roleName:0", label: "角色1", minW: 96 },
  { key: "roleDesc:0", label: "角色描述1", minW: 180 },
  { key: "roleImage:0", label: "角色图1", minW: 84 },
  { key: "roleName:1", label: "角色2", minW: 92 },
];

export const INLINE_COLUMNS_MEDIUM: TableCol[] = [
  { key: "shotNumber", label: "镜号", minW: 54 },
  { key: "durationHint", label: "时长", minW: 66 },
  { key: "description", label: "画面描述", minW: 160 },
  { key: "roleName:0", label: "角色1", minW: 88 },
  { key: "roleDesc:0", label: "角色描述1", minW: 156 },
  { key: "roleImage:0", label: "角色图1", minW: 70 },
  { key: "roleName:1", label: "角色2", minW: 84 },
];

/** 极小宽度时才触发降级：缩字段并去掉次要列，横向滚动作为补充 */
export const INLINE_COLUMNS_COMPACT: TableCol[] = [
  { key: "shotNumber", label: "镜号", minW: 52 },
  { key: "durationHint", label: "时长", minW: 62 },
  { key: "description", label: "画面描述", minW: 148 },
  { key: "roleName:0", label: "角色1", minW: 82 },
  { key: "roleDesc:0", label: "角色描述1", minW: 140 },
];

export function inlineFixedWidthByContainer(key: TableColKey, w: number): number | undefined {
  if (w < 760) {
    const compact: Partial<Record<TableColKey, number>> = {
      shotNumber: 50,
      durationHint: 58,
      description: 148,
      "roleName:0": 76,
      "roleDesc:0": 140,
    };
    return compact[key];
  }
  if (w < 1020) {
    const medium: Partial<Record<TableColKey, number>> = {
      shotNumber: 52,
      durationHint: 62,
      description: 160,
      "roleName:0": 82,
      "roleDesc:0": 156,
      "roleImage:0": 64,
      "roleName:1": 78,
    };
    return medium[key];
  }
  const wide: Partial<Record<TableColKey, number>> = {
    shotNumber: 56,
    durationHint: 68,
    description: 180,
    "roleName:0": 88,
    "roleDesc:0": 180,
    "roleImage:0": 72,
    "roleName:1": 84,
  };
  return wide[key];
}

export function getInlineColWidth(c: TableCol, containerW: number): number {
  const fixed = inlineFixedWidthByContainer(c.key, containerW);
  if (fixed) return fixed;
  return c.minW ?? 120;
}

export const DEFAULT_HIDDEN_COLS: string[] = [];

export const EMOTION_OPTIONS = scriptEnums.emotion;
export const CAMERA_MOVE_OPTIONS = scriptEnums.cameraMove;
export const DIALOGUE_TYPE_OPTIONS = scriptEnums.dialogueType;
export const BGM_MOOD_OPTIONS = scriptEnums.bgmMood;
export const SHOT_SIZE_OPTIONS = SHOT_TYPE_OPTIONS;

export const SCRIPT_TABLE_HIDDEN_COLS_STORAGE_KEY = "scriptWorkbench.fullscreen.hiddenCols.v1";
export const SCRIPT_TABLE_FILTER_STORAGE_KEY = "scriptWorkbench.fullscreen.filterQuery.v1";
export const SCRIPT_TABLE_FIELDS_QUERY_SESSION_KEY = "scriptWorkbench.fullscreen.fieldsQuery.session.v1";
export const SCRIPT_TABLE_COLUMN_KEYS = new Set<string>(SCRIPT_BEATS_FULLSCREEN_BASE_COLUMNS.map((c) => c.key));

export function loadHiddenColsFromStorage(): Set<string> {
  if (typeof window === "undefined" || !window.localStorage) {
    return new Set<string>(DEFAULT_HIDDEN_COLS);
  }
  try {
    const raw = window.localStorage.getItem(SCRIPT_TABLE_HIDDEN_COLS_STORAGE_KEY);
    if (!raw) return new Set<string>(DEFAULT_HIDDEN_COLS);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>(DEFAULT_HIDDEN_COLS);
    const next = parsed.filter((x): x is string => typeof x === "string" && SCRIPT_TABLE_COLUMN_KEYS.has(x));
    return new Set<string>(next);
  } catch {
    return new Set<string>(DEFAULT_HIDDEN_COLS);
  }
}

export function persistHiddenColsToStorage(hiddenCols: Set<string>) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(SCRIPT_TABLE_HIDDEN_COLS_STORAGE_KEY, JSON.stringify(Array.from(hiddenCols)));
  } catch {
    /* ignore */
  }
}

export function loadFilterQueryFromStorage(): string {
  if (typeof window === "undefined" || !window.localStorage) return "";
  try {
    const raw = window.localStorage.getItem(SCRIPT_TABLE_FILTER_STORAGE_KEY);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export function persistFilterQueryToStorage(filterQuery: string) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(SCRIPT_TABLE_FILTER_STORAGE_KEY, filterQuery);
  } catch {
    /* ignore */
  }
}

export function loadFieldsQueryFromSession(): string {
  if (typeof window === "undefined" || !window.sessionStorage) return "";
  try {
    const raw = window.sessionStorage.getItem(SCRIPT_TABLE_FIELDS_QUERY_SESSION_KEY);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export function persistFieldsQueryToSession(fieldsQuery: string) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(SCRIPT_TABLE_FIELDS_QUERY_SESSION_KEY, fieldsQuery);
  } catch {
    /* ignore */
  }
}

export function rowMatchesFilter(b: ScriptBeat, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const keys: (keyof ScriptBeat)[] = [
    "shotNumber",
    "episodeSceneShot",
    "sceneHeading",
    "durationHint",
    "shotSize",
    "cameraMove",
    "cameraAngle",
    "description",
    "emotion",
    "rhythmTag",
    "sceneTags",
    "soundHint",
    "editFocus",
    "dialogue",
    "dialogueType",
    "performanceNote",
    "bgmHint",
    "storyboardBlock",
    "storyboardPrompt",
    "videoMotionPrompt",
    "character1",
    "character1Desc",
    "character2",
    "character2Desc",
  ];
  const roles = getBeatRoles(b);
  if (roles.some((r) => [r.name, r.description, r.action, r.emotion, r.lines].some((x) => (x ?? "").toLowerCase().includes(t)))) {
    return true;
  }
  for (const k of keys) {
    const v = b[k];
    if (typeof v === "string" && v.toLowerCase().includes(t)) return true;
  }
  return false;
}

export function updateRoleField(
  rowsIn: ScriptBeat[],
  rowIdx: number,
  roleIdx: number,
  patch: Partial<ScriptRole>,
): ScriptBeat[] {
  const row = rowsIn[rowIdx];
  if (!row) return rowsIn;
  const roles = [...(row.characters ?? [])];
  while (roles.length <= roleIdx) {
    roles.push({
      id: crypto.randomUUID(),
      name: "",
      description: "",
      imagePath: "",
      reference: "",
      action: "",
      emotion: "",
      lines: "",
    });
  }
  roles[roleIdx] = { ...roles[roleIdx], ...patch };
  return rowsIn.map((r, i) => {
    if (i !== rowIdx) return r;
    return applyCharactersToBeat(r, roles);
  });
}

export function getRoleCompat(b: ScriptBeat, roleIdx: number): ScriptRole {
  const role = b.characters?.[roleIdx];
  if (role) return role;
  const legacy = legacyRoleFromBeat(b, roleIdx);
  if (legacy) return legacy;
  return createEmptyScriptRole();
}
