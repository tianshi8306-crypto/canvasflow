import type { HermesCanvasEvent } from "@/lib/hermes/agent/hermesCanvasEvents";
import {
  isCanvasReferentFresh,
  parseShotNumberFromLabel,
} from "@/lib/hermes/agent/hermesCanvasReferent";
import { getCachedCanvasEvents } from "@/lib/hermes/agent/hermesCanvasEventCache";
import { getCachedHermesWorkstate } from "@/lib/hermes/agent/hermesWorkstate";
import { parseShotNumbersFromMessage } from "@/lib/hermes/hermesCanvasContext";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import { useProjectBibleStore } from "@/store/projectBibleStore";
import { useProjectStore } from "@/store/projectStore";

/** 用户用指代词指向「当前/刚才那镜」而非明确镜号 */
const SHOT_REFERENT_RE =
  /那镜|这镜|这一镜|那一镜|刚才(?:那|的)?镜|刚刚(?:那|的)?镜|上一镜|刚改(?:的)?镜|刚编辑(?:的)?镜|这个镜头|那个镜头|当前镜|选中镜|这镜头|那镜头/;

/** 无「镜」字但语境在操作最近镜头 */
const IMPLICIT_SHOT_ACTION_RE =
  /(?:刚才|刚刚|上次)(?:改|选|动|出|重试)|(?:把|对|给)(?:那|这|刚才|刚刚)(?:一)?镜|(?:重试|再出).*(?:刚才|刚刚)/;

const REFERENT_EVENT_KINDS = new Set<HermesCanvasEvent["kind"]>([
  "storyboard_edited",
  "selection_focused",
]);

export function messageHasShotReferent(text: string): boolean {
  const t = text.trim();
  return SHOT_REFERENT_RE.test(t) || IMPLICIT_SHOT_ACTION_RE.test(t);
}

export function shotNumbersFromCanvasEvents(
  events: HermesCanvasEvent[],
): number[] {
  const found = new Set<number>();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (!REFERENT_EVENT_KINDS.has(e.kind)) continue;
    const n = parseShotNumberFromLabel(e.shotNumber);
    if (n != null) found.add(n);
    if (found.size > 0) break;
  }
  return [...found].sort((a, b) => a - b);
}

export type ResolveShotNumbersOpts = {
  canvasEvents?: HermesCanvasEvent[];
  selectedBeatShotNumber?: string;
  lastCanvasReferentShotNumber?: string;
};

/**
 * 先解析明确镜号；若无镜号但有指代语境，则回落到近期画布事件、选中镜或 workstate 默认镜。
 */
export function resolveShotNumbersWithReferents(
  text: string,
  opts?: ResolveShotNumbersOpts,
): number[] {
  const explicit = parseShotNumbersFromMessage(text);
  if (explicit.length > 0) return explicit;
  if (!messageHasShotReferent(text)) return [];

  const fromEvents = shotNumbersFromCanvasEvents(opts?.canvasEvents ?? []);
  if (fromEvents.length > 0) return fromEvents;

  const fromSelection = parseShotNumberFromLabel(opts?.selectedBeatShotNumber);
  if (fromSelection != null) return [fromSelection];

  const fromPersisted = parseShotNumberFromLabel(opts?.lastCanvasReferentShotNumber);
  return fromPersisted != null ? [fromPersisted] : [];
}

/** 从工程 store + 画布事件/workstate 缓存解析镜号（规划/工具共用） */
export function resolveHermesShotNumbers(text: string): number[] {
  const state = useProjectStore.getState();
  const situation = buildHermesSituation(
    state.nodes,
    state.edges,
    state.projectPath,
    {
      selectedNodeIds: state.selectedNodeIds,
      bible: useProjectBibleStore.getState().bible,
    },
  );
  const ws = getCachedHermesWorkstate();
  const persistedShot =
    ws && isCanvasReferentFresh(ws.lastCanvasReferent)
      ? ws.lastCanvasReferent!.shotNumber
      : undefined;
  return resolveShotNumbersWithReferents(text, {
    canvasEvents: getCachedCanvasEvents(),
    selectedBeatShotNumber: situation.selection.beatShotNumber,
    lastCanvasReferentShotNumber: persistedShot,
  });
}
