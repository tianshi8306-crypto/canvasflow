import type { ComposeTimelineClip } from "@/lib/compose/timelineClips";

export type TimelineHistorySnapshot = {
  clips: ComposeTimelineClip[];
  selectedIndex: number;
  playheadSec: number;
};

const MAX_STACK = 50;

function cloneSnapshot(s: TimelineHistorySnapshot): TimelineHistorySnapshot {
  return {
    clips: s.clips.map((c) => ({ ...c })),
    selectedIndex: s.selectedIndex,
    playheadSec: s.playheadSec,
  };
}

export type TimelineHistory = {
  push: (before: TimelineHistorySnapshot) => void;
  undo: (current: TimelineHistorySnapshot) => TimelineHistorySnapshot | null;
  redo: (current: TimelineHistorySnapshot) => TimelineHistorySnapshot | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
};

export function createTimelineHistory(): TimelineHistory {
  const past: TimelineHistorySnapshot[] = [];
  let future: TimelineHistorySnapshot[] = [];

  return {
    push(before) {
      past.push(cloneSnapshot(before));
      if (past.length > MAX_STACK) past.shift();
      future = [];
    },
    undo(current) {
      const prev = past.pop();
      if (!prev) return null;
      future.push(cloneSnapshot(current));
      return prev;
    },
    redo(current) {
      const next = future.pop();
      if (!next) return null;
      past.push(cloneSnapshot(current));
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past.length = 0;
      future = [];
    },
  };
}
