import type { HermesProactiveSuggestion } from "@/lib/hermes/hermesProactiveSuggestions";

type Props = {
  suggestions: HermesProactiveSuggestion[];
  disabled?: boolean;
  onApply: (prompt: string, suggestionId: string) => void;
  onDismiss: (suggestionId: string, message?: string) => void;
};

export function HermesProactiveChips({
  suggestions,
  disabled,
  onApply,
  onDismiss,
}: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="hermesProactiveChips" role="region" aria-label="主动建议">
      <span className="hermesProactiveChipsLabel">建议下一步</span>
      <div className="hermesProactiveChipsRow">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className={`hermesProactiveChip hermesProactiveChip--${s.severity}`}
          >
            <button
              type="button"
              className="hermesProactiveChipMain"
              disabled={disabled}
              title={s.actionPrompt}
              onClick={() => onApply(s.actionPrompt, s.id)}
            >
              <span className="hermesProactiveChipMessage">{s.message}</span>
              <span className="hermesProactiveChipAction">{s.actionLabel}</span>
            </button>
            <button
              type="button"
              className="hermesProactiveChipDismiss"
              disabled={disabled}
              aria-label="忽略此建议"
              onClick={() => onDismiss(s.id, s.message)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
