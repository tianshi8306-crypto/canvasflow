import { VideoRefThumbnail } from "@/components/nodes/VideoRefThumbnail";
import "./VideoGenerationPanel.css";

export type UpstreamTextConnectionThumbItem = {
  nodeId: string;
  label: string;
};

type Props = {
  items: UpstreamTextConnectionThumbItem[];
};

/**
 * 上游文本连线确认标签（与视频底栏 mmThumb--text 同款，仅示意已连接）。
 */
export function UpstreamTextConnectionThumbs({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className="videoGenPanel--chrome upstreamTextConnectionThumbs"
      aria-label="上游文本连线"
    >
      <div className="mmToolsAndThumbs mmToolsAndThumbs--compact mmToolsAndThumbs--hasRefs">
        <div className="mmThumbsWrapper">
          <div className="mmThumbsScrollZone">
            <div className="mmThumbs">
              {items.map((item, index) => (
                <VideoRefThumbnail
                  key={item.nodeId}
                  badgeLabel={String(index + 1)}
                  atToken={`@文本${index + 1}`}
                  kind="text"
                  nodeLabel={item.label}
                  edgeId={item.nodeId}
                  tagOnly
                  hideDelete
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
