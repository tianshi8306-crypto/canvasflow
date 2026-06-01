import { useLayoutEffect, useRef, useState } from "react";
import {
  HERMES_ORB_SUGGEST_ESTIMATED_WIDTH,
  resolveOrbSuggestPosition,
} from "@/lib/hermes/hermesCanvasDock";
import type { HermesOrbDock } from "@/lib/hermes/hermesShellPrefs";
import type { HermesOrbSuggestion } from "@/lib/hermes/hermesOrbSuggestions";

type Props = {
  orbPos: HermesOrbDock;
  wrapW: number;
  wrapH: number;
  suggestion: HermesOrbSuggestion;
  onAction: () => void;
  onDismiss: () => void;
};

export function HermesOrbSuggestionPopover({
  orbPos,
  wrapW,
  wrapH,
  suggestion,
  onAction,
  onDismiss,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    setMeasuredWidth(null);
  }, [suggestion.id, suggestion.message, suggestion.actionLabel, wrapW]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0) {
      setMeasuredWidth((prev) => (prev === w ? prev : w));
    }
  }, [suggestion.id, suggestion.message, suggestion.actionLabel, wrapW, measuredWidth]);

  const layout = resolveOrbSuggestPosition(
    orbPos,
    wrapW,
    wrapH,
    measuredWidth ?? HERMES_ORB_SUGGEST_ESTIMATED_WIDTH,
  );

  return (
    <div
      ref={ref}
      className={`hermesOrbSuggest hermesOrbSuggest--${suggestion.severity} hermesOrbSuggest--${layout.placement}`}
      style={{
        left: layout.left,
        top: layout.top,
        maxWidth: layout.maxWidth,
      }}
      role="dialog"
      aria-label="Hermes 建议"
    >
      <div className="hermesOrbSuggestHead">
        <span className="hermesOrbSuggestKicker">H 建议</span>
      </div>
      <p className="hermesOrbSuggestMessage">{suggestion.message}</p>
      <div className="hermesOrbSuggestActions">
        <button type="button" className="hermesOrbSuggestAction" onClick={onAction}>
          {suggestion.actionLabel}
        </button>
        <button type="button" className="hermesOrbSuggestDismiss" onClick={onDismiss}>
          稍后
        </button>
      </div>
    </div>
  );
}
