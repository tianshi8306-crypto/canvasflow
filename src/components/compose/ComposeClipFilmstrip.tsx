import { ComposeFilmstripFrame } from "@/components/compose/ComposeFilmstripFrame";
import { filmstripCellCount, filmstripSeekTimes } from "@/lib/compose/composeFilmstripLayout";

type Props = {
  relPath: string;
  inSec: number;
  durationSec: number;
  widthPx: number;
};

export function ComposeClipFilmstrip({ relPath, inSec, durationSec, widthPx }: Props) {
  const count = filmstripCellCount(widthPx);
  const times = filmstripSeekTimes(inSec, durationSec, count);

  return (
    <div className="composeTimelineFilmstrip" aria-hidden>
      {times.map((seekSec, i) => (
        <div key={`${relPath}-${i}-${seekSec.toFixed(2)}`} className="composeTimelineFilmstripCell">
          <ComposeFilmstripFrame relPath={relPath} seekSec={seekSec} />
        </div>
      ))}
    </div>
  );
}
