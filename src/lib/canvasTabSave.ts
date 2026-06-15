import { invoke, isTauri } from "@tauri-apps/api/core";
import type { CanvasTab } from "@/store/canvasUiStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { deriveNodeCountersFromCanvas } from "@/lib/projectWorkspaceLoad";
import { parseCanvas } from "@/lib/serialization";
import { serializeCanvasToBytesIncremental, yieldToMain } from "@/lib/serializeCanvasAsync";

async function resolveCountersForTabSave(
  projectPath: string,
  nodes: CanvasTab["nodes"],
): Promise<{
  imageNodeCounter: number;
  videoNodeCounter: number;
  textNodeCounter: number;
  audioNodeCounter: number;
  scriptNodeCounter: number;
}> {
  const derived = deriveNodeCountersFromCanvas(nodes);
  try {
    const raw = await invoke<string>("read_canvasflow_json", { projectPath });
    const { meta } = parseCanvas(raw);
    return {
      imageNodeCounter: Math.max(meta?.imageNodeCounter ?? 0, derived.imageNodeCounter),
      videoNodeCounter: Math.max(meta?.videoNodeCounter ?? 0, derived.videoNodeCounter),
      textNodeCounter: Math.max(meta?.textNodeCounter ?? 0, derived.textNodeCounter),
      audioNodeCounter: Math.max(meta?.audioNodeCounter ?? 0, derived.audioNodeCounter),
      scriptNodeCounter: Math.max(meta?.scriptNodeCounter ?? 0, derived.scriptNodeCounter),
    };
  } catch {
    return derived;
  }
}

/**
 * 将非激活 Tab 的快照写入其工程目录（仅 canvasflow.json，不切换 projectStore）。
 */
export async function saveCanvasTabToProjectDisk(tab: CanvasTab): Promise<boolean> {
  if (!isTauri()) return false;
  const projectPath = tab.projectPath?.trim();
  if (!projectPath) return false;
  if (!tab.unsaved) return true;

  try {
    const counters = await resolveCountersForTabSave(projectPath, tab.nodes);
    await yieldToMain();
    const content = serializeCanvasToBytesIncremental(
      tab.nodes,
      tab.edges,
      tab.viewport,
      counters,
    );
    await yieldToMain();
    await invoke("write_canvasflow_json_bytes", { projectPath, content });
    useCanvasUiStore.getState().updateTab(tab.id, { unsaved: false });
    return true;
  } catch {
    return false;
  }
}
