export const NUDGE_STEP_PX = 1;
export const NUDGE_STEP_LARGE_PX = 10;

export function nudgeDeltaFromArrowKey(
  key: string,
  shiftKey: boolean,
): { dx: number; dy: number } | null {
  const step = shiftKey ? NUDGE_STEP_LARGE_PX : NUDGE_STEP_PX;
  switch (key) {
    case "ArrowLeft":
      return { dx: -step, dy: 0 };
    case "ArrowRight":
      return { dx: step, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -step };
    case "ArrowDown":
      return { dx: 0, dy: step };
    default:
      return null;
  }
}
