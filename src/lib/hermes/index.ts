/**
 * Hermes 自动串联模块导出
 *
 * 使用方式：在 App 初始化时调用 initHermesAutoChain()
 */

import { setupNodeEventListener, rebuildShotNodeRegistry } from "./autoChain";
import { initHermesCanvasAwareness } from "./initHermesCanvasAwareness";
import { initHermesStyleAnchorRecording } from "./initHermesStyleAnchorRecording";
import { initHermesTaskTrack } from "./initHermesTaskTrack";
import { initHermesKnowledge } from "./knowledge/initHermesKnowledge";
import { initHermesCanvasMcpBridge } from "./mcp/initHermesCanvasMcpBridge";
import { syncCanvasMcpBridgeContext } from "./mcp/syncCanvasMcpBridgeContext";

let cleanupFn: (() => void) | null = null;
let mcpBridgeCleanup: (() => void) | null = null;

/**
 * 初始化 Hermes 自动串联
 * 应在 App 启动时调用一次
 * @returns 清理函数，可选调用
 */
export function initHermesAutoChain(): () => void {
  if (cleanupFn) {
    console.warn("[Hermes] 已初始化，无需重复调用");
    return () => {
      cleanupFn?.();
      mcpBridgeCleanup?.();
    };
  }

  initHermesTaskTrack();
  initHermesStyleAnchorRecording();
  initHermesCanvasAwareness();
  initHermesKnowledge();
  mcpBridgeCleanup = initHermesCanvasMcpBridge();
  cleanupFn = setupNodeEventListener();
  return () => {
    cleanupFn?.();
    mcpBridgeCleanup?.();
    cleanupFn = null;
    mcpBridgeCleanup = null;
  };
}

export { syncCanvasMcpBridgeContext };

/**
 * 重建 shotNodeRegistry
 * 当工程重新打开或加载时调用，以从节点数据恢复映射关系
 */
export { rebuildShotNodeRegistry };

/**
 * 手动触发指定 scriptNode 的自动串联
 * 用于调试或手动重试
 */
export { handleScriptNodeCompleted } from "./autoChain";

export type { HermesShotNodeGroup, HermesAutoChainResult } from "./types";
export {
  loadHermesAutoChainSettings,
  saveHermesAutoChainSettings,
  hermesAutoChainSettingsHint,
  HERMES_STORYBOARD_AGENT_NAME,
  type HermesAutoChainSettings,
  type HermesBatchSplitStrategy,
  type HermesNodeOverride,
} from "./hermesAutoChainPolicy";
export { planHermesBatchImageJobs } from "./hermesBatchSplitStrategy";
