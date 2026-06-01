import { ScriptReferenceVideoBanner } from "@/components/script/ScriptReferenceVideoBanner";

type Props = {
  nodeId: string;
};

/** 有上游视频连线时：画布节点上方「参考视频」入口 */
export function ScriptNodeReferenceVideoFloat({ nodeId }: Props) {
  return <ScriptReferenceVideoBanner nodeId={nodeId} variant="float" />;
}
