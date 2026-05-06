import { useEffect, type Dispatch, type SetStateAction } from "react";

type ReplayArmState = { id: string; left: number } | null;

export function getNextReplayArmState(cur: ReplayArmState): ReplayArmState {
  if (!cur) return null;
  if (cur.left <= 1) return null;
  return { ...cur, left: cur.left - 1 };
}

export function useReplayArmCountdown(
  replayArm: ReplayArmState,
  setReplayArm: Dispatch<SetStateAction<ReplayArmState>>,
) {
  useEffect(() => {
    if (!replayArm) return;
    const timer = window.setInterval(() => {
      setReplayArm((cur) => getNextReplayArmState(cur));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [replayArm, setReplayArm]);
}
