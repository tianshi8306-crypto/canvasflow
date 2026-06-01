import { isTauri } from "@tauri-apps/api/core";
import { hermesKnowledgeReindex } from "@/lib/hermes/knowledge/hermesKnowledgeSearch";

const REINDEX_SESSION_KEY = "canvasflow.hermesKnowledgeReindex.v2";

/** 应用启动时重建内置知识库 FTS（每会话一次） */
export function initHermesKnowledge(): void {
  if (!isTauri()) return;
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(REINDEX_SESSION_KEY)) {
    return;
  }
  void hermesKnowledgeReindex()
    .then((count) => {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(REINDEX_SESSION_KEY, String(Date.now()));
      }
      if (count > 0) {
        console.debug(`[Hermes] knowledge reindexed (${count} docs)`);
      }
    })
    .catch((err) => {
      console.warn("[Hermes] knowledge reindex skipped:", err);
    });
}
