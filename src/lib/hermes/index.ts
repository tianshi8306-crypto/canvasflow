/**
 * Hermes 自动串联模块导出
 *
 * 使用方式：在 App 初始化时调用 initHermesAutoChain()
 */

import { setupNodeEventListener, rebuildShotNodeRegistry } from "./autoChain";

let cleanupFn: (() => void) | null = null;

/**
 * 初始化 Hermes 自动串联
 * 应在 App 启动时调用一次
 * @returns 清理函数，可选调用
 */
export function initHermesAutoChain(): () => void {
  if (cleanupFn) {
    console.warn("[Hermes] 已初始化，无需重复调用");
    return cleanupFn;
  }

  cleanupFn = setupNodeEventListener();
  return cleanupFn;
}

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
