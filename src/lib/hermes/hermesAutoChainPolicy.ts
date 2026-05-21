import type { ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";

export const HERMES_AUTO_CHAIN_STORAGE_KEY = "canvasflow.hermesAutoChain.v1";

/** 分镜文案生成完成后可触发 Hermes 建链 */
export const HERMES_STORYBOARD_AGENT_NAME = "分镜生成 Agent";

export type HermesGlobalScope = "all_ready" | "selected_only";

export type HermesNodeOverride = "inherit" | "off" | "on";

/** Hermes 排队出图时的多图拆镜策略 */
export type HermesBatchSplitStrategy = "per_beat" | "pack_forward";

export type HermesBatchSplitNodeOverride = "inherit" | HermesBatchSplitStrategy;

export const HERMES_PACK_IMAGE_COUNT_MIN = 2;
export const HERMES_PACK_IMAGE_COUNT_MAX = 4;

export type HermesAutoChainSettings = {
  /** 全局开关，默认关闭 */
  enabled: boolean;
  /** all_ready：所有已生成分镜的镜头；selected_only：仅工作台勾选且分镜已就绪 */
  scope: HermesGlobalScope;
  /** per_beat：每镜按节点张数单独出图；pack_forward：首镜打包多图并拆镜入库后续空缺镜 */
  batchSplitStrategy: HermesBatchSplitStrategy;
  /** pack_forward 时单次打包张数（2–4） */
  packImageCount: number;
};

const DEFAULT_SETTINGS: HermesAutoChainSettings = {
  enabled: false,
  scope: "selected_only",
  batchSplitStrategy: "pack_forward",
  packImageCount: 4,
};

export function clampHermesPackImageCount(value: number): number {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.packImageCount;
  return Math.min(HERMES_PACK_IMAGE_COUNT_MAX, Math.max(HERMES_PACK_IMAGE_COUNT_MIN, n));
}

export function defaultHermesAutoChainSettings(): HermesAutoChainSettings {
  return { ...DEFAULT_SETTINGS };
}

export function loadHermesAutoChainSettings(): HermesAutoChainSettings {
  if (typeof localStorage === "undefined") return defaultHermesAutoChainSettings();
  try {
    const raw = localStorage.getItem(HERMES_AUTO_CHAIN_STORAGE_KEY);
    if (!raw) return defaultHermesAutoChainSettings();
    const parsed = JSON.parse(raw) as Partial<HermesAutoChainSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      scope: parsed.scope === "all_ready" ? "all_ready" : "selected_only",
      batchSplitStrategy:
        parsed.batchSplitStrategy === "per_beat" ? "per_beat" : "pack_forward",
      packImageCount: clampHermesPackImageCount(
        typeof parsed.packImageCount === "number" ? parsed.packImageCount : DEFAULT_SETTINGS.packImageCount,
      ),
    };
  } catch {
    return defaultHermesAutoChainSettings();
  }
}

export function saveHermesAutoChainSettings(next: HermesAutoChainSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(HERMES_AUTO_CHAIN_STORAGE_KEY, JSON.stringify(next));
}

export function readHermesNodeOverride(
  params: Record<string, unknown> | undefined,
): HermesNodeOverride {
  const raw = params?.hermesAutoChain;
  if (raw === "off" || raw === "on") return raw;
  return "inherit";
}

export function readHermesBatchSplitNodeOverride(
  params: Record<string, unknown> | undefined,
): HermesBatchSplitNodeOverride {
  const raw = params?.hermesBatchSplit;
  if (raw === "per_beat" || raw === "pack_forward") return raw;
  return "inherit";
}

export function resolveHermesBatchSplitSettings(
  global: HermesAutoChainSettings,
  nodeParams: Record<string, unknown> | undefined,
): Pick<HermesAutoChainSettings, "batchSplitStrategy" | "packImageCount"> {
  const nodeOverride = readHermesBatchSplitNodeOverride(nodeParams);
  const strategy =
    nodeOverride === "inherit" ? global.batchSplitStrategy : nodeOverride;
  const nodePack = paramsPackCount(nodeParams);
  return {
    batchSplitStrategy: strategy,
    packImageCount: nodePack ?? global.packImageCount,
  };
}

function paramsPackCount(params: Record<string, unknown> | undefined): number | undefined {
  const raw = params?.hermesPackImageCount;
  if (typeof raw !== "number") return undefined;
  return clampHermesPackImageCount(raw);
}

export function resolveHermesEnabled(
  global: HermesAutoChainSettings,
  nodeOverride: HermesNodeOverride,
): boolean {
  if (nodeOverride === "off") return false;
  if (nodeOverride === "on") return true;
  return global.enabled;
}

/** 分镜已就绪：status=generated 且 visualPrompt 非空 */
export function isStoryboardShotReady(shot: StoryboardShot | undefined): boolean {
  if (!shot) return false;
  return shot.status === "generated" && Boolean(shot.visualPrompt?.trim());
}

export function listStoryboardReadyBeatIds(
  beats: ScriptBeat[],
  shots: StoryboardShot[] | undefined,
  beatFilter?: Set<string>,
): string[] {
  const shotByBeat = new Map((shots ?? []).map((s) => [s.scriptBeatId, s]));
  const out: string[] = [];
  for (const b of normalizeScriptBeats(beats)) {
    if (beatFilter && !beatFilter.has(b.id)) continue;
    if (isStoryboardShotReady(shotByBeat.get(b.id))) out.push(b.id);
  }
  return out;
}

export type HermesAutoChainTriggerResult =
  | { shouldRun: true; beatIds: string[]; scopeLabel: string }
  | { shouldRun: false; reason: string };

/**
 * 分镜 Agent 完成后评估是否自动 Hermes 建链。
 * 非目标：脚本解析完成、无人值守全片跑完。
 */
export function evaluateHermesAutoChainTrigger(opts: {
  globalSettings: HermesAutoChainSettings;
  nodeParams: Record<string, unknown> | undefined;
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
  scriptBeatSelection: string[] | undefined;
}): HermesAutoChainTriggerResult {
  const nodeOverride = readHermesNodeOverride(opts.nodeParams);
  if (!resolveHermesEnabled(opts.globalSettings, nodeOverride)) {
    return { shouldRun: false, reason: "Hermes 自动建链已关闭" };
  }

  const beatsNorm = normalizeScriptBeats(opts.beats);
  if (beatsNorm.length === 0) {
    return { shouldRun: false, reason: "无脚本镜头，跳过 Hermes 自动建链" };
  }

  const useSelectedOnly = opts.globalSettings.scope === "selected_only";

  const selection = (opts.scriptBeatSelection ?? []).filter((id) =>
    beatsNorm.some((b) => b.id === id),
  );

  if (useSelectedOnly && selection.length === 0) {
    return {
      shouldRun: false,
      reason: "未勾选镜头：自动建链仅作用于勾选范围，请在工作台勾选后再生成分镜",
    };
  }

  const filterSet = useSelectedOnly ? new Set(selection) : undefined;
  const readyIds = listStoryboardReadyBeatIds(beatsNorm, opts.shots, filterSet);

  if (readyIds.length === 0) {
    return {
      shouldRun: false,
      reason: useSelectedOnly
        ? "勾选镜头尚无已生成分镜文案，未自动建链"
        : "尚无已生成分镜文案的镜头，未自动建链",
    };
  }

  const scopeLabel = useSelectedOnly
    ? `勾选且分镜就绪 ${readyIds.length} 镜`
    : `分镜就绪 ${readyIds.length} 镜`;

  return { shouldRun: true, beatIds: readyIds, scopeLabel };
}

export function hermesBatchSplitStrategyLabel(
  strategy: HermesBatchSplitStrategy,
  packImageCount: number,
): string {
  return strategy === "pack_forward"
    ? `打包拆镜（${packImageCount} 张/包）`
    : "逐镜出图（沿用各图片节点张数）";
}

export function hermesAutoChainSettingsHint(settings: HermesAutoChainSettings): string {
  if (!settings.enabled) {
    return "Hermes 自动建链：关闭（可在设置 → 系统 中开启；分镜完成后不会自动创建图/视频节点）";
  }
  const scope =
    settings.scope === "selected_only"
      ? "仅勾选且分镜文案就绪"
      : "全部分镜文案就绪";
  const split =
    settings.batchSplitStrategy === "pack_forward"
      ? `打包拆镜 ${settings.packImageCount} 张`
      : "逐镜出图";
  return `Hermes 自动建链：开启 · ${scope} · 批量出图：${split}`;
}
