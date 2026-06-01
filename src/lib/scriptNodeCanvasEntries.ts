import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

export const SCRIPT_ENTRY_FULLSCREEN_LABEL = "全屏表格";
export const SCRIPT_ENTRY_FULLSCREEN_TITLE =
  "在大窗口中编辑全部镜头列与创意视图（Esc 关闭）";

export const SCRIPT_ENTRY_THEME_LABEL = "编辑主题";
export const SCRIPT_ENTRY_THEME_TITLE =
  "放大编辑剧情主题与解析要求，使用底栏所选模型（Esc 关闭）";

export const SCRIPT_MINI_PREVIEW_OPEN_HINT = "点击打开全屏表格";

/** 脚本节点编辑入口说明（全屏 / 最大化；无运行时侧栏 Inspector） */
export const SCRIPT_NODE_ENTRY_HINT =
  "入口：节点顶栏「全屏表格 / 编辑主题」；壳内预览可点进全屏；右键双击节点可打开最大化工作台。";

/** @deprecated 使用 {@link SCRIPT_NODE_ENTRY_HINT} */
export const SCRIPT_INSPECTOR_ENTRY_HINT = SCRIPT_NODE_ENTRY_HINT;

/** 打开脚本全屏 Overlay（镜头表 + 创意视图） */
export function openScriptNodeFullscreen(nodeId: string): void {
  useProjectStore.getState().openScriptFullscreen(nodeId);
}

/** 打开脚本主题 Composer 放大 Modal */
export function openScriptThemeEditor(nodeId: string): void {
  useCanvasUiStore.getState().setScriptGenPanelExpandedNodeId(nodeId);
}

/**
 * 选中脚本节点并在全屏「创意视图」聚焦指定镜头。
 * 落点：ScriptNodeFullscreenOverlay（非侧栏 Inspector）；最大化 Overlay 内分镜区仍可读同一 focus。
 */
export function openInspectorStoryboardBeat(scriptNodeId: string, beatId: string): void {
  useProjectStore.getState().setSelectedNodeIds([scriptNodeId]);
  useProjectStore.getState().openScriptFullscreen(scriptNodeId);
  useCanvasUiStore.getState().setInspectorStoryboardFocus({ scriptNodeId, beatId });
}
