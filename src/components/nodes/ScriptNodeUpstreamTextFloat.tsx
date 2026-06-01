import { ScriptUpstreamTextBanner } from "@/components/script/ScriptUpstreamTextBanner";

type Props = {
  nodeId: string;
};

/** 有上游文本连线时：画布节点上方「上游剧本」入口（定位文本节点，解析时自动读正文） */
export function ScriptNodeUpstreamTextFloat({ nodeId }: Props) {
  return <ScriptUpstreamTextBanner nodeId={nodeId} variant="float" />;
}
