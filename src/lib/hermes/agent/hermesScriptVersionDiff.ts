import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import type { HermesScriptVersionPayload } from "@/lib/hermes/agent/hermesScriptVersion";

export type ScriptVersionFieldChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type ScriptVersionRowDiff = {
  kind: "added" | "removed" | "changed" | "unchanged";
  key: string;
  shotNumber: string;
  title: string;
  fields: ScriptVersionFieldChange[];
};

export type ScriptVersionVisualDiff = {
  briefChanged: boolean;
  briefBefore: string;
  briefAfter: string;
  beatRows: ScriptVersionRowDiff[];
  shotRows: ScriptVersionRowDiff[];
  stats: {
    beatsAdded: number;
    beatsRemoved: number;
    beatsChanged: number;
    shotsAdded: number;
    shotsRemoved: number;
    shotsChanged: number;
  };
};

const BEAT_FIELDS: Array<{ key: keyof ScriptBeat; label: string }> = [
  { key: "description", label: "画面描述" },
  { key: "dialogue", label: "台词" },
  { key: "durationHint", label: "时长" },
  { key: "storyboardPrompt", label: "分镜提示" },
  { key: "videoMotionPrompt", label: "运动提示" },
  { key: "shotSize", label: "景别" },
];

const SHOT_FIELDS: Array<{ key: keyof StoryboardShot; label: string }> = [
  { key: "visualPrompt", label: "画面 prompt" },
  { key: "compositionNote", label: "构图" },
  { key: "negativePrompt", label: "负面提示" },
  { key: "status", label: "状态" },
];

function norm(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function beatKey(b: ScriptBeat): string {
  return b.id?.trim() || b.shotId?.trim() || `shot-${b.shotNumber}`;
}

function shotKey(s: StoryboardShot): string {
  return s.scriptBeatId?.trim() || "";
}

function compareFields<T extends object>(
  before: T,
  after: T,
  defs: Array<{ key: keyof T; label: string }>,
): ScriptVersionFieldChange[] {
  const out: ScriptVersionFieldChange[] = [];
  for (const { key, label } of defs) {
    const a = norm(before[key]);
    const b = norm(after[key]);
    if (a !== b) {
      out.push({ field: String(key), label, before: a, after: b });
    }
  }
  return out;
}

function shotNumberSort(a: string, b: string): number {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, "zh-CN");
}

function beatTitle(b: ScriptBeat): string {
  const desc = norm(b.description).slice(0, 36);
  return desc ? `镜 ${b.shotNumber} · ${desc}` : `镜 ${b.shotNumber}`;
}

function shotTitle(shotNumber: string, s: StoryboardShot): string {
  const p = norm(s.visualPrompt).slice(0, 36);
  return p ? `镜 ${shotNumber} · ${p}` : `镜 ${shotNumber}`;
}

function diffEntityRows<T extends object>(opts: {
  beforeMap: Map<string, T>;
  afterMap: Map<string, T>;
  keyOf: (item: T) => string;
  shotNumberOf: (item: T, key: string) => string;
  titleOf: (item: T, shotNumber: string) => string;
  fields: Array<{ key: keyof T; label: string }>;
}): ScriptVersionRowDiff[] {
  const keys = new Set([...opts.beforeMap.keys(), ...opts.afterMap.keys()]);
  const rows: ScriptVersionRowDiff[] = [];

  for (const key of keys) {
    const before = opts.beforeMap.get(key);
    const after = opts.afterMap.get(key);
    const shotNumber = before
      ? opts.shotNumberOf(before, key)
      : after
        ? opts.shotNumberOf(after, key)
        : key;

    if (before && !after) {
      rows.push({
        kind: "removed",
        key,
        shotNumber,
        title: opts.titleOf(before, shotNumber),
        fields: opts.fields.map(({ key: fk, label }) => ({
          field: String(fk),
          label,
          before: norm(before[fk]),
          after: "",
        })),
      });
      continue;
    }
    if (!before && after) {
      rows.push({
        kind: "added",
        key,
        shotNumber,
        title: opts.titleOf(after, shotNumber),
        fields: opts.fields.map(({ key: fk, label }) => ({
          field: String(fk),
          label,
          before: "",
          after: norm(after[fk]),
        })),
      });
      continue;
    }
    if (before && after) {
      const fields = compareFields(before, after, opts.fields);
      rows.push({
        kind: fields.length > 0 ? "changed" : "unchanged",
        key,
        shotNumber,
        title: opts.titleOf(after, shotNumber),
        fields,
      });
    }
  }

  return rows.sort((x, y) => shotNumberSort(x.shotNumber, y.shotNumber));
}

export function computeScriptVersionVisualDiff(
  older: HermesScriptVersionPayload,
  newer: HermesScriptVersionPayload,
): ScriptVersionVisualDiff {
  const briefBefore = norm(older.prompt);
  const briefAfter = norm(newer.prompt);
  const briefChanged = briefBefore !== briefAfter;

  const beatsBefore = new Map(
    (older.scriptBeats ?? []).map((b) => [beatKey(b), b] as const),
  );
  const beatsAfter = new Map(
    (newer.scriptBeats ?? []).map((b) => [beatKey(b), b] as const),
  );

  const beatRows = diffEntityRows({
    beforeMap: beatsBefore,
    afterMap: beatsAfter,
    keyOf: beatKey,
    shotNumberOf: (b) => norm(b.shotNumber) || "?",
    titleOf: beatTitle,
    fields: BEAT_FIELDS,
  });

  const shotNumberByBeatId = new Map<string, string>();
  for (const b of [...beatsBefore.values(), ...beatsAfter.values()]) {
    shotNumberByBeatId.set(beatKey(b), norm(b.shotNumber) || "?");
  }

  const shotsBefore = new Map(
    (older.storyboardShots ?? []).map((s) => [shotKey(s), s] as const),
  );
  const shotsAfter = new Map(
    (newer.storyboardShots ?? []).map((s) => [shotKey(s), s] as const),
  );

  const shotRows = diffEntityRows({
    beforeMap: shotsBefore,
    afterMap: shotsAfter,
    keyOf: shotKey,
    shotNumberOf: (_s, key) => shotNumberByBeatId.get(key) ?? "?",
    titleOf: (s, shotNumber) => shotTitle(shotNumber, s),
    fields: SHOT_FIELDS,
  });

  const count = (rows: ScriptVersionRowDiff[], kind: ScriptVersionRowDiff["kind"]) =>
    rows.filter((r) => r.kind === kind).length;

  return {
    briefChanged,
    briefBefore,
    briefAfter,
    beatRows,
    shotRows,
    stats: {
      beatsAdded: count(beatRows, "added"),
      beatsRemoved: count(beatRows, "removed"),
      beatsChanged: count(beatRows, "changed"),
      shotsAdded: count(shotRows, "added"),
      shotsRemoved: count(shotRows, "removed"),
      shotsChanged: count(shotRows, "changed"),
    },
  };
}

/** 仅展示有变化的行（added / removed / changed） */
export function filterScriptVersionDiffRows(
  rows: ScriptVersionRowDiff[],
): ScriptVersionRowDiff[] {
  return rows.filter((r) => r.kind !== "unchanged");
}

export function formatScriptVersionVisualDiffSummary(
  diff: ScriptVersionVisualDiff,
): string {
  const parts: string[] = [];
  const { stats } = diff;
  if (diff.briefChanged) parts.push("梗概已变更");
  if (stats.beatsAdded) parts.push(`+${stats.beatsAdded} 镜表`);
  if (stats.beatsRemoved) parts.push(`-${stats.beatsRemoved} 镜表`);
  if (stats.beatsChanged) parts.push(`~${stats.beatsChanged} 镜表字段`);
  if (stats.shotsAdded) parts.push(`+${stats.shotsAdded} 分镜`);
  if (stats.shotsRemoved) parts.push(`-${stats.shotsRemoved} 分镜`);
  if (stats.shotsChanged) parts.push(`~${stats.shotsChanged} 分镜字段`);
  return parts.length > 0 ? parts.join(" · ") : "无结构变化";
}
