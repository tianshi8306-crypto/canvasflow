import { commitNodeMediaPatch } from "@/lib/nodeMediaRef";
import type { FlowNodeData } from "@/lib/types";
import { getAssetByRelPath } from "@/shared/api/assets";

/** 导出成片后写回合成节点（path + output + 可选 assetId）。 */
export async function patchComposeNodeAfterExport(
  projectPath: string,
  outputRelPath: string,
): Promise<Partial<FlowNodeData>> {
  const rel = outputRelPath.trim();
  let assetId: string | undefined;
  try {
    const row = await getAssetByRelPath(projectPath, rel);
    assetId = row?.assetId?.trim() || undefined;
  } catch {
    assetId = undefined;
  }
  return {
    output: rel,
    ...commitNodeMediaPatch(rel, assetId),
  };
}
