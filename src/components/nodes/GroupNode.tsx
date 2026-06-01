import type { CSSProperties } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { countGroupMembers, GROUP_MIN_HEIGHT, GROUP_MIN_WIDTH } from "@/lib/canvasGroup";
import { resolveGroupColorToken } from "@/lib/canvasGroupColors";
import {
  getGroupMemberNodes,
  groupKindLabel,
  isStoryboardGroup,
} from "@/lib/canvasGroupStoryboard";
import {
  aggregateGroupRunState,
  groupRunAggregateLabel,
} from "@/lib/canvasGroupRunState";
import { useProjectStore } from "@/store/projectStore";

const RIM = 10;

/** 打组底板：标题外置 + 边框拖动手柄，拖动时 React Flow 连带子节点一体平移 */
export function GroupNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const nodes = useProjectStore((s) => s.nodes);
  const nodeRunStateById = useProjectStore((s) => s.nodeRunStateById);
  const memberCount = countGroupMembers(nodes, id);
  const self = nodes.find((n) => n.id === id);
  const title = groupKindLabel(self?.data.groupKind, memberCount);
  const storyboard = isStoryboardGroup(self);
  const color = resolveGroupColorToken(data.groupColorToken);
  const members = getGroupMemberNodes(nodes, id);
  const runAgg = aggregateGroupRunState(
    members.map((m) => m.id),
    nodeRunStateById,
  );
  const runLabel = groupRunAggregateLabel(runAgg);

  const chromeStyle: CSSProperties | undefined =
    color && !selected
      ? {
          borderColor: color.border,
          background: `color-mix(in srgb, ${color.bg} 28%, var(--cf-group-plate-fill))`,
        }
      : color && selected
        ? {
            background: `color-mix(in srgb, ${color.bg} 20%, var(--cf-group-plate-fill))`,
          }
        : undefined;

  const handleStyle: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    border: "1px solid rgba(255, 255, 255, 0.72)",
    background: "var(--cf-charcoal-surface)",
    boxSizing: "border-box",
  };

  return (
    <>
      <div
        className={[
          "groupNodeRoot",
          "groupNodeChrome",
          selected ? "groupNodeChrome--selected" : "",
          storyboard ? "groupNodeChrome--storyboard" : "",
          color ? `groupNodeChrome--color-${color.id}` : "",
          runAgg !== "idle" ? `groupNodeChrome--run-${runAgg}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={chromeStyle}
      >
        <div
          className="groupNode__dragHandle groupNodePlateDrag"
          title="拖动底板移动整组"
          aria-hidden
        />
        <div
          className="groupNode__dragHandle groupNodeTitleOutside"
          title="拖动底板移动整组"
        >
          <span>{title}</span>
          {runLabel ? (
            <span className={`groupRunBadge groupRunBadge--${runAgg}`} title={runLabel}>
              {runLabel}
            </span>
          ) : null}
        </div>

        <div
          className="groupNode__dragHandle groupNodeRimDrag groupNodeRimDrag--top"
          style={{ height: RIM }}
          aria-hidden
        />
        <div
          className="groupNode__dragHandle groupNodeRimDrag groupNodeRimDrag--bottom"
          style={{ height: RIM }}
          aria-hidden
        />
        <div
          className="groupNode__dragHandle groupNodeRimDrag groupNodeRimDrag--left"
          style={{ width: RIM, top: RIM, bottom: RIM }}
          aria-hidden
        />
        <div
          className="groupNode__dragHandle groupNodeRimDrag groupNodeRimDrag--right"
          style={{ width: RIM, top: RIM, bottom: RIM }}
          aria-hidden
        />

        {selected ? (
          <NodeResizer
            isVisible
            minWidth={GROUP_MIN_WIDTH}
            minHeight={GROUP_MIN_HEIGHT}
            keepAspectRatio={false}
            autoScale={false}
            handleClassName="groupNodeResizeHandle"
            handleStyle={handleStyle}
            lineClassName="groupNodeResizeLine"
            lineStyle={{ border: "none" }}
          />
        ) : null}
      </div>
    </>
  );
}
