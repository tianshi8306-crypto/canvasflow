import type { Edge, Node } from "@xyflow/react";

import type { FlowNodeData } from "@/lib/types";

import type { IncomingImageRef } from "@/lib/imageGeneration/types";

import {

  collectIncomingImagePanelItems,

  imagePanelItemsToIncomingRefs,

} from "@/lib/imageGeneration/collectIncomingImagePanelItems";



const MAX_INCOMING_IMAGE_REFS = 4;



/**

 * 采集连入目标节点的上游有效参考图（未解析 assetId）。

 * 按源节点 Y 升序；同一 source 只保留一条；最多 4 条。

 */

export function collectIncomingImageRefs(

  nodes: Node<FlowNodeData>[],

  edges: Edge[],

  targetNodeId: string,

): { refs: IncomingImageRef[]; truncated: boolean } {

  const { items, imagesTruncated } = collectIncomingImagePanelItems(nodes, edges, targetNodeId);

  const refs = imagePanelItemsToIncomingRefs(items).slice(0, MAX_INCOMING_IMAGE_REFS);

  return { refs, truncated: imagesTruncated };

}



export { MAX_INCOMING_IMAGE_REFS };


