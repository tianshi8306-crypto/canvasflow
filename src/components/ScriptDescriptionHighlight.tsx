import type { ScriptBeat } from "@/lib/types";
import {
  collectRoleNamesForBeat,
  splitDescriptionWithRoleHighlights,
} from "@/lib/scriptDescriptionHighlight";

type Props = {
  beat: ScriptBeat;
  text: string;
  className?: string;
};

export function ScriptDescriptionHighlight({ beat, text, className = "" }: Props) {
  const segments = splitDescriptionWithRoleHighlights(text, collectRoleNamesForBeat(beat));
  return (
    <span className={`scriptDescHighlight ${className}`.trim()}>
      {segments.map((seg, i) =>
        seg.kind === "role" ? (
          <mark key={`${i}-${seg.text}`} className="scriptDescHighlight-role">
            {seg.text}
          </mark>
        ) : (
          <span key={`${i}-${seg.text.slice(0, 8)}`}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
