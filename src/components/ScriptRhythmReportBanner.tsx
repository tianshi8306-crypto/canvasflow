import type { ScriptRhythmReport } from "@/lib/types";

type Props = {
  report: ScriptRhythmReport | undefined;
};

export function ScriptRhythmReportBanner({ report }: Props) {
  if (!report) return null;
  const total = report.totalDurationSec;
  const shots = report.shotCount;
  const closeUp = report.closeUpPercent;
  const hook = (report.first30sHook ?? "").trim();
  const first30s = report.first30sShotCount;
  if (!total && !shots && !closeUp && !hook) return null;

  return (
    <div className="scriptRhythmReport" role="note" aria-label="集级节奏报告">
      <div className="scriptRhythmReport__title">节奏报告</div>
      <div className="scriptRhythmReport__grid">
        {typeof total === "number" && (
          <span className="scriptRhythmReport__item">
            总时长 <strong>{total.toFixed(1)}s</strong>
          </span>
        )}
        {typeof shots === "number" && (
          <span className="scriptRhythmReport__item">
            镜头数 <strong>{shots}</strong>
          </span>
        )}
        {typeof closeUp === "number" && (
          <span className="scriptRhythmReport__item">
            特写占比 <strong>{closeUp}%</strong>
          </span>
        )}
        {typeof first30s === "number" && first30s > 0 && (
          <span className="scriptRhythmReport__item">
            前30秒 <strong>{first30s} 镜</strong>
          </span>
        )}
      </div>
      {hook && (
        <p className="scriptRhythmReport__hook">
          <span className="scriptRhythmReport__hookLabel">前30秒钩子</span>
          {hook}
        </p>
      )}
    </div>
  );
}
