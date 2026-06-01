import { useLayoutEffect, useRef, useState } from "react";
import {
  HERMES_ORB_SUGGEST_ESTIMATED_WIDTH,
  resolveOrbSuggestPosition,
} from "@/lib/hermes/hermesCanvasDock";
import type { HermesOrbDock } from "@/lib/hermes/hermesShellPrefs";
import {
  orbActivityLabel,
  type HermesOrbActivity,
} from "@/lib/hermes/agent/hermesOrbActivity";

type Props = {
  orbPos: HermesOrbDock;
  wrapW: number;
  wrapH: number;
  activity: HermesOrbActivity;
  lines: string[];
  /** 失败时固定展示（非仅 hover） */
  pinned?: boolean;
  onOpenDetails: () => void;
  onOpenChat?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export function HermesOrbProgressPeek({
  orbPos,
  wrapW,
  wrapH,
  activity,
  lines,
  pinned = false,
  onOpenDetails,
  onOpenChat,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    setMeasuredWidth(null);
  }, [activity, lines.join("|"), wrapW, pinned]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0) setMeasuredWidth((prev) => (prev === w ? prev : w));
  }, [activity, lines, wrapW, measuredWidth, pinned]);

  const layout = resolveOrbSuggestPosition(
    orbPos,
    wrapW,
    wrapH,
    measuredWidth ?? HERMES_ORB_SUGGEST_ESTIMATED_WIDTH,
  );

  const showFailedActions = activity === "failed";
  const kicker = orbActivityLabel(activity);

  return (
    <div
      ref={ref}
      className={`hermesOrbProgressPeek hermesOrbProgressPeek--${activity}${pinned ? " hermesOrbProgressPeek--pinned" : ""}`}
      style={{
        left: layout.left,
        top: layout.top,
        maxWidth: layout.maxWidth,
      }}
      role="tooltip"
      aria-label={`${kicker}：${lines.join("；") || "暂无详情"}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="hermesOrbProgressPeekHead">
        <span className="hermesOrbProgressPeekKicker">{kicker}</span>
      </div>
      {lines.length > 0 ? (
        <ul className="hermesOrbProgressPeekList">
          {lines.map((line) => (
            <li key={line} className="hermesOrbProgressPeekLine">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hermesOrbProgressPeekEmpty">任务执行中…</p>
      )}
      {showFailedActions ? (
        <div className="hermesOrbProgressPeekActions">
          <button
            type="button"
            className="hermesOrbProgressPeekAction"
            onClick={onOpenDetails}
          >
            看详情
          </button>
          {onOpenChat ? (
            <button
              type="button"
              className="hermesOrbProgressPeekSecondary"
              onClick={onOpenChat}
            >
              打开对话
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
