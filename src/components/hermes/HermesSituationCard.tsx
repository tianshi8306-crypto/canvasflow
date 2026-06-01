import { formatPipelinePhaseHeadline } from "@/lib/hermes/hermesGlobalUnderstanding";
import type { HermesSituation, HermesSituationGap } from "@/lib/hermes/hermesSituation";

type Props = {
  situation: HermesSituation;
  disabled?: boolean;
  onGapAction?: (prompt: string, gapId: string) => void;
};

function gapClass(severity: HermesSituationGap["severity"]): string {
  if (severity === "block") return "hermesSituationGap--block";
  if (severity === "warn") return "hermesSituationGap--warn";
  return "hermesSituationGap--info";
}

export function HermesSituationCard({ situation, disabled, onGapAction }: Props) {
  const { headline, gaps, production } = situation;
  const phaseLine = formatPipelinePhaseHeadline(situation);
  const hasDetail =
    situation.ctx.scriptNodeId &&
    (production.beatCount > 0 || gaps.length > 0);

  if (!hasDetail && !situation.ctx.projectPath) {
    return (
      <div className="hermesSituationCard" role="status">
        <p className="hermesSituationHeadline">{headline}</p>
      </div>
    );
  }

  return (
    <div className="hermesSituationCard" role="region" aria-label="制片感知">
      <p className="hermesSituationHeadline" title={headline}>
        {phaseLine ? `${phaseLine} — ${headline}` : headline}
      </p>
      {gaps.length > 0 ? (
        <ul className="hermesSituationGaps">
          {gaps.map((gap) => (
            <li key={gap.id} className={`hermesSituationGap ${gapClass(gap.severity)}`}>
              {gap.suggestedPrompt?.trim() && onGapAction ? (
                <button
                  type="button"
                  className="hermesSituationGapBtn"
                  disabled={disabled}
                  title={gap.suggestedPrompt}
                  onClick={() => onGapAction(gap.suggestedPrompt!.trim(), gap.id)}
                >
                  {gap.message}
                  <span className="hermesSituationGapCta"> · 执行</span>
                </button>
              ) : (
                <span>{gap.message}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
