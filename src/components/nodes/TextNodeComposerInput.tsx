import type { SyntheticEvent, WheelEvent as ReactWheelEvent } from "react";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";

type Props = {
  hasBody: boolean;
  value: string;
  maxChars: number;
  onChange: (value: string) => void;
  onPointerDown: (e: SyntheticEvent) => void;
  onWheel: (e: ReactWheelEvent) => void;
};

export function TextNodeComposerInput({
  hasBody,
  value,
  maxChars,
  onChange,
  onPointerDown,
  onWheel,
}: Props) {
  return (
    <textarea
      key={hasBody ? "body" : "empty"}
      className={`scriptGenComposerInput ${RF_NODE_INPUT_CLASS}`}
      placeholder="写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。"
      value={value}
      rows={3}
      maxLength={maxChars}
      onChange={(e) => onChange(e.currentTarget.value)}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    />
  );
}
