/** 分组色标 token（写入 group.data.groupColorToken） */
export type GroupColorToken =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "gray"
  /** @deprecated 兼容旧工程，展示同 purple */
  | "violet"
  /** @deprecated 兼容旧工程，展示同 orange */
  | "amber"
  /** @deprecated 兼容旧工程，展示同 green */
  | "emerald"
  /** @deprecated 兼容旧工程，展示同 pink */
  | "rose";

export type GroupColorOption = {
  id: GroupColorToken;
  label: string;
  border: string;
  bg: string;
  /** 色标圆点填充（弹出面板用） */
  fill: string;
};

/** 2×5 弹出面板顺序：首格为「无」，其余 9 色 */
export const GROUP_COLOR_GRID: GroupColorToken[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "gray",
];

/** 除红/灰外均为青蓝系不同明度（对齐 canvas-color-system） */
const CYAN_A = {
  border: "var(--cf-cyan-pale)",
  bg: "var(--cf-cyan-fill-35)",
  fill: "var(--cf-cyan-pale)",
};
const CYAN_B = {
  border: "var(--cf-cyan-light)",
  bg: "var(--cf-cyan-fill-35)",
  fill: "var(--cf-cyan-light)",
};
const CYAN_C = {
  border: "var(--cf-cyan)",
  bg: "var(--cf-cyan-fill-35)",
  fill: "var(--cf-cyan)",
};
const CYAN_D = {
  border: "var(--cf-cyan-deep)",
  bg: "var(--cf-cyan-fill-35)",
  fill: "var(--cf-cyan-deep)",
};

export const GROUP_COLOR_OPTIONS: GroupColorOption[] = [
  { id: "red", label: "红", border: "#f87171", bg: "rgba(248, 113, 113, 0.38)", fill: "#ef4444" },
  { id: "orange", label: "青浅", ...CYAN_A },
  { id: "yellow", label: "青", ...CYAN_B },
  { id: "green", label: "青", ...CYAN_C },
  { id: "teal", label: "青", ...CYAN_C },
  { id: "blue", label: "青深", ...CYAN_D },
  { id: "purple", label: "青亮", ...CYAN_B },
  { id: "pink", label: "青浅", ...CYAN_A },
  { id: "gray", label: "灰", border: "#94a3b8", bg: "rgba(148, 163, 184, 0.35)", fill: "#64748b" },
  { id: "violet", label: "青亮", ...CYAN_B },
  { id: "amber", label: "青浅", ...CYAN_A },
  { id: "emerald", label: "青", ...CYAN_C },
  { id: "rose", label: "青浅", ...CYAN_A },
];

const COLOR_BY_ID = new Map(GROUP_COLOR_OPTIONS.map((c) => [c.id, c]));

export function resolveGroupColorToken(token: string | undefined): GroupColorOption | null {
  if (!token) return null;
  return COLOR_BY_ID.get(token as GroupColorToken) ?? null;
}

export function normalizeGroupColorToken(
  token: string | undefined,
): GroupColorToken | null {
  if (!token) return null;
  const resolved = resolveGroupColorToken(token);
  return resolved?.id ?? null;
}
