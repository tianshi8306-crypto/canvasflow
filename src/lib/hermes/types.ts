/**
 * Hermes 自动串联相关类型定义
 */

/**
 * 单个 Shot 创建的节点组
 */
export interface HermesShotNodeGroup {
  imageGenNodeId: string;
  videoShotNodeId: string;
  scriptBeatId: string;
  shotIndex: number;
}

/**
 * 自动串联执行结果
 */
export interface HermesAutoChainResult {
  total: number;
  succeeded: number;
  failed: number;
  groups: HermesShotNodeGroup[];
}
