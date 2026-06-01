/**
 * 用于节点内可编辑区域：配合 React Flow 的 noWheel / noPan / noDrag 机制，
 * 避免滚轮缩放画布、拖拽误平移、拖节点与文本选择冲突。
 * @see https://reactflow.dev/learn/troubleshooting/common-issues#preventing-zoom--pan--scroll
 */
export const RF_NODE_INPUT_CLASS = "nodrag nopan nowheel";

/** 节点外侧连接锚点热区：禁止拖节点/平移画布，拖线由 Handle 承接 */
export const RF_NODE_ANCHOR_CLASS = "nodrag nopan";
