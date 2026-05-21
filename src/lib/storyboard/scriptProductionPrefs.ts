const AUTO_COMPOSE_PREVIEW_AFTER_BATCH_KEY = "canvasflow.scriptProduction.autoComposePreviewAfterBatch";

/** 批量视频结束后是否自动等待落盘并打开/更新成片合成节点（默认开启） */
export function readAutoComposePreviewAfterBatchVideo(): boolean {
  try {
    const v = localStorage.getItem(AUTO_COMPOSE_PREVIEW_AFTER_BATCH_KEY);
    if (v === "0" || v === "false") return false;
    return true;
  } catch {
    return true;
  }
}

export function writeAutoComposePreviewAfterBatchVideo(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_COMPOSE_PREVIEW_AFTER_BATCH_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
