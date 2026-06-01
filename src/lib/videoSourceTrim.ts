import type { VideoSourceTrim } from "@/lib/videoNodeTypes";

const MIN_TRIM_SPAN_SEC = 0.1;

export function normalizeVideoSourceTrim(
  trim: VideoSourceTrim,
  durationSec: number,
): VideoSourceTrim {
  const d = Math.max(MIN_TRIM_SPAN_SEC, durationSec);
  const inSec = Math.max(0, Math.min(trim.inSec, d - MIN_TRIM_SPAN_SEC));
  let outSec = Math.max(inSec + MIN_TRIM_SPAN_SEC, Math.min(trim.outSec, d));
  if (outSec > d) outSec = d;
  if (outSec - inSec < MIN_TRIM_SPAN_SEC) {
    outSec = Math.min(d, inSec + MIN_TRIM_SPAN_SEC);
  }
  return { inSec, outSec };
}

export function defaultVideoSourceTrim(durationSec: number): VideoSourceTrim {
  const d = Math.max(MIN_TRIM_SPAN_SEC, durationSec);
  return { inSec: 0, outSec: d };
}

export function trimSpanSec(trim: VideoSourceTrim): number {
  return Math.max(0, trim.outSec - trim.inSec);
}
