import type { ScriptBeat } from "@/lib/types";
import { getBeatRoles } from "@/lib/scriptBeatsTableModel";

export type DescriptionHighlightSegment = {
  text: string;
  kind: "plain" | "role";
};

export function collectRoleNamesForBeat(beat: ScriptBeat): string[] {
  const fromRoles = getBeatRoles(beat)
    .map((r) => (r.name ?? "").trim())
    .filter(Boolean);
  const legacy = [(beat.character1 ?? "").trim(), (beat.character2 ?? "").trim()].filter(Boolean);
  const unique = new Set([...fromRoles, ...legacy]);
  return Array.from(unique).sort((a, b) => b.length - a.length);
}

/** 按已知角色名高亮画面描述（不做 @ 解析） */
export function splitDescriptionWithRoleHighlights(
  text: string,
  roleNames: string[],
): DescriptionHighlightSegment[] {
  if (!text) return [{ text: "", kind: "plain" }];
  if (roleNames.length === 0) return [{ text, kind: "plain" }];

  const segments: DescriptionHighlightSegment[] = [];
  let i = 0;
  while (i < text.length) {
    let matched: string | null = null;
    for (const name of roleNames) {
      if (text.startsWith(name, i)) {
        matched = name;
        break;
      }
    }
    if (matched) {
      segments.push({ text: matched, kind: "role" });
      i += matched.length;
      continue;
    }
    const nextBreak = (() => {
      let earliest = text.length;
      for (const name of roleNames) {
        const pos = text.indexOf(name, i + 1);
        if (pos !== -1 && pos < earliest) earliest = pos;
      }
      return earliest;
    })();
    segments.push({ text: text.slice(i, nextBreak), kind: "plain" });
    i = nextBreak;
  }

  const merged: DescriptionHighlightSegment[] = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const last = merged[merged.length - 1];
    if (last && last.kind === seg.kind) {
      last.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged.length > 0 ? merged : [{ text, kind: "plain" }];
}
