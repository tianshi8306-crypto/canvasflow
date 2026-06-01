import {
  formatHermesContextStripLine,
  resolveHermesContextStripTone,
  shouldShowHermesContextStrip,
} from "@/lib/hermes/hermesContextStrip";
import type { HermesSituation } from "@/lib/hermes/hermesSituation";

type Props = {
  situation: HermesSituation;
};

/** 浮窗 composer 上方：一行 Situation 短句（ContextStrip） */
export function HermesContextStrip({ situation }: Props) {
  if (!shouldShowHermesContextStrip(situation.ctx.projectPath)) return null;

  const line = formatHermesContextStripLine(situation);
  const tone = resolveHermesContextStripTone(situation);

  return (
    <p
      className={`hermesContextStrip hermesContextStrip--${tone}`}
      role="status"
      aria-live="polite"
      title={line}
    >
      {line}
    </p>
  );
}
