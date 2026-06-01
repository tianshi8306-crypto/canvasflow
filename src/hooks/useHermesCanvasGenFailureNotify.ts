import { useEffect, useRef } from "react";
import {
  notifyHermesCanvasGenFailure,
  type CanvasGenFailureKind,
} from "@/lib/hermes/notifyHermesCanvasGenFailure";

type Options = {
  nodeId: string;
  kind: CanvasGenFailureKind;
  isFailed: boolean;
  isGenerating: boolean;
  error?: string | null;
  nodeLabel?: string;
  dreaminaSubmitId?: string | null;
};

/** 生成失败时通知灵体（同一 nodeId+error 只通知一次，直至失败态清除） */
export function useHermesCanvasGenFailureNotify({
  nodeId,
  kind,
  isFailed,
  isGenerating,
  error,
  nodeLabel,
  dreaminaSubmitId,
}: Options): void {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!nodeId.trim()) return;
    if (!isFailed || isGenerating) {
      if (!isFailed) lastKeyRef.current = null;
      return;
    }
    const err = error?.trim();
    if (!err) return;
    const key = `${nodeId}:${err}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    notifyHermesCanvasGenFailure({
      nodeId,
      kind,
      error: err,
      nodeLabel,
      dreaminaSubmitId,
    });
  }, [
    dreaminaSubmitId,
    error,
    isFailed,
    isGenerating,
    kind,
    nodeId,
    nodeLabel,
  ]);
}
