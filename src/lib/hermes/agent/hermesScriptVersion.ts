import { invoke, isTauri } from "@tauri-apps/api/core";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import {
  computeScriptVersionVisualDiff,
  formatScriptVersionVisualDiffSummary,
} from "@/lib/hermes/agent/hermesScriptVersionDiff";
import { persistVersionStyleReferent } from "@/lib/hermes/agent/hermesCanvasEventCache";
import { buildVersionStyleReferentFromEntry } from "@/lib/hermes/agent/hermesVersionReferent";
import { useProjectStore } from "@/store/projectStore";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

export const HERMES_SCRIPT_VERSIONS_REL_PATH = ".canvasflow/hermes/script-versions.json";

const MAX_VERSIONS = 24;

export type HermesScriptVersionPayload = {
  prompt?: string;
  scriptBeats?: ScriptBeat[];
  storyboardShots?: StoryboardShot[];
};

export type HermesScriptVersionEntry = {
  id: string;
  scriptNodeId: string;
  label: string;
  createdAt: string;
  beatCount: number;
  shotCount: number;
  payload: HermesScriptVersionPayload;
};

export type HermesScriptVersionStore = {
  version: 1;
  entries: HermesScriptVersionEntry[];
};

function emptyStore(): HermesScriptVersionStore {
  return { version: 1, entries: [] };
}

function clonePayload(data: FlowNodeData): HermesScriptVersionPayload {
  return {
    prompt: data.prompt?.trim() || undefined,
    scriptBeats: data.scriptBeats?.length
      ? structuredClone(data.scriptBeats)
      : undefined,
    storyboardShots: data.storyboardShots?.length
      ? structuredClone(data.storyboardShots)
      : undefined,
  };
}

export async function loadHermesScriptVersions(
  projectPath: string | null,
): Promise<HermesScriptVersionStore> {
  if (!projectPath?.trim() || !isTauri()) return emptyStore();
  try {
    const raw = await invoke<string>("read_project_rel_text_file", {
      projectPath: projectPath.trim(),
      relPath: HERMES_SCRIPT_VERSIONS_REL_PATH,
    });
    const parsed = JSON.parse(raw) as Partial<HermesScriptVersionStore>;
    if (!Array.isArray(parsed.entries)) return emptyStore();
    return {
      version: 1,
      entries: parsed.entries.filter(
        (e) => e && e.id && e.scriptNodeId && e.payload,
      ) as HermesScriptVersionEntry[],
    };
  } catch {
    return emptyStore();
  }
}

async function saveHermesScriptVersions(
  projectPath: string,
  store: HermesScriptVersionStore,
): Promise<void> {
  if (!isTauri()) return;
  const trimmed = store.entries.slice(-MAX_VERSIONS);
  await invoke("write_project_rel_text_file", {
    projectPath: projectPath.trim(),
    relPath: HERMES_SCRIPT_VERSIONS_REL_PATH,
    content: JSON.stringify({ version: 1, entries: trimmed }, null, 2),
  });
}

export function scriptVersionPayloadFromNode(
  node: Node<FlowNodeData> | undefined,
): HermesScriptVersionPayload | null {
  if (!node || node.type !== "scriptNode") return null;
  const payload = clonePayload(node.data);
  const hasContent =
    Boolean(payload.prompt) ||
    (payload.scriptBeats?.length ?? 0) > 0 ||
    (payload.storyboardShots?.length ?? 0) > 0;
  return hasContent ? payload : null;
}

/** Agent 写脚本/分镜成功后存档 */
/** 写脚本/分镜前预快照，便于大改后回滚 */
export async function captureScriptVersionBeforeChange(opts: {
  projectPath: string;
  scriptNodeId: string;
  toolId: string;
}): Promise<HermesScriptVersionEntry | null> {
  return captureScriptVersionFromStore({
    projectPath: opts.projectPath,
    scriptNodeId: opts.scriptNodeId,
    label: `pre:${opts.toolId}`,
  });
}

export async function captureScriptVersionFromStore(opts: {
  projectPath: string;
  scriptNodeId: string;
  label: string;
}): Promise<HermesScriptVersionEntry | null> {
  const node = useProjectStore
    .getState()
    .nodes.find((n) => n.id === opts.scriptNodeId && n.type === "scriptNode");
  const payload = scriptVersionPayloadFromNode(node);
  if (!payload) return null;

  const store = await loadHermesScriptVersions(opts.projectPath);
  const entry: HermesScriptVersionEntry = {
    id: `sv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    scriptNodeId: opts.scriptNodeId,
    label: opts.label.trim() || "snapshot",
    createdAt: new Date().toISOString(),
    beatCount: payload.scriptBeats?.length ?? 0,
    shotCount: payload.storyboardShots?.length ?? 0,
    payload,
  };
  store.entries.push(entry);
  await saveHermesScriptVersions(opts.projectPath, store);

  const list = listScriptVersionsForNode(store, opts.scriptNodeId);
  if (list.length >= 2) {
    const older = list[list.length - 2]!;
    await persistVersionStyleReferent(
      opts.projectPath,
      buildVersionStyleReferentFromEntry(older),
    );
  }

  return entry;
}

export function listScriptVersionsForNode(
  store: HermesScriptVersionStore,
  scriptNodeId: string,
): HermesScriptVersionEntry[] {
  return store.entries.filter((e) => e.scriptNodeId === scriptNodeId);
}

export function formatScriptVersionList(
  entries: HermesScriptVersionEntry[],
): string {
  if (entries.length === 0) {
    return "尚无脚本版本快照。Agent 改脚本/分镜成功后会自动存档；也可说「保存脚本快照」。";
  }
  return entries
    .slice()
    .reverse()
    .slice(0, 12)
    .map((e) => {
      const shortId = e.id.slice(0, 12);
      const when = e.createdAt.slice(0, 16).replace("T", " ");
      return `· \`${shortId}\` ${when} · ${e.label} · ${e.beatCount} 镜表 / ${e.shotCount} 分镜`;
    })
    .join("\n");
}

export function summarizeScriptVersionDiff(
  a: HermesScriptVersionPayload,
  b: HermesScriptVersionPayload,
): string {
  const visual = computeScriptVersionVisualDiff(a, b);
  const summary = formatScriptVersionVisualDiffSummary(visual);
  const detail = filterChangedShotLines(visual);
  return detail.length > 0 ? `${summary}\n${detail.join("\n")}` : summary;
}

function filterChangedShotLines(
  visual: ReturnType<typeof computeScriptVersionVisualDiff>,
): string[] {
  const lines: string[] = [];
  for (const row of visual.beatRows) {
    if (row.kind !== "changed") continue;
    for (const f of row.fields.slice(0, 2)) {
      lines.push(`镜 ${row.shotNumber} ${f.label}：${f.before.slice(0, 24)} → ${f.after.slice(0, 24)}`);
    }
  }
  return lines.slice(0, 6);
}

export function applyScriptVersionToCanvas(
  scriptNodeId: string,
  payload: HermesScriptVersionPayload,
): void {
  useProjectStore.getState().updateNodeData(scriptNodeId, {
    ...(payload.prompt !== undefined ? { prompt: payload.prompt } : {}),
    ...(payload.scriptBeats !== undefined ? { scriptBeats: payload.scriptBeats } : {}),
    ...(payload.storyboardShots !== undefined
      ? { storyboardShots: payload.storyboardShots }
      : {}),
  });
}

export async function rollbackScriptVersion(opts: {
  projectPath: string;
  scriptNodeId: string;
  /** 指定 id 前缀；否则回滚到上一存档（倒数第二条） */
  versionIdPrefix?: string;
}): Promise<{ ok: boolean; message: string }> {
  const store = await loadHermesScriptVersions(opts.projectPath);
  const list = listScriptVersionsForNode(store, opts.scriptNodeId);
  if (list.length === 0) {
    return { ok: false, message: "没有可回滚的脚本版本。" };
  }

  let target: HermesScriptVersionEntry | undefined;
  if (opts.versionIdPrefix?.trim()) {
    const prefix = opts.versionIdPrefix.trim().toLowerCase();
    target = [...list]
      .reverse()
      .find((e) => e.id.toLowerCase().startsWith(prefix));
  } else if (list.length >= 2) {
    target = list[list.length - 2];
  } else {
    target = list[list.length - 1];
  }

  if (!target) {
    return { ok: false, message: "未找到匹配的版本 id。" };
  }

  applyScriptVersionToCanvas(opts.scriptNodeId, target.payload);
  return {
    ok: true,
    message: `已回滚到 ${target.createdAt.slice(0, 16).replace("T", " ")} · ${target.label}（${target.id.slice(0, 12)}）`,
  };
}

export function resolvePrimaryScriptNodeId(
  nodes: Node<FlowNodeData>[],
): string | null {
  return findPrimaryScriptNode(nodes)?.id ?? null;
}

export function parseScriptVersionIdFromMessage(text: string): string | undefined {
  const m = text.match(/`?(sv-[a-z0-9-]+)`?/i);
  return m?.[1];
}

export const SCRIPT_VERSION_SNAPSHOT_TOOLS = new Set([
  "script.update_brief",
  "script.generate_outline",
  "script.generate_storyboard",
  "storyboard.patch_shot",
]);
