import { memo, type CSSProperties, type ReactNode, type RefObject } from "react";
import type React from "react";

type Props = {
  selected: boolean;
  width: number;
  height: number;
  previewRef?: RefObject<HTMLDivElement | null>;
  shellClassName?: string;
  previewClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
  afterPreview?: ReactNode;
};

function NodeChromeShell({
  selected,
  width,
  height,
  previewRef,
  shellClassName = "",
  previewClassName = "",
  style,
  children,
  afterPreview,
}: Props) {
  const shellCls = [
    "nodeChrome-shell",
    "minimal-image-node",
    selected ? "selected" : "",
    shellClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const previewCls = ["nodeChrome-preview", "minimal-image-preview", previewClassName]
    .filter(Boolean)
    .join(" ");

  const shellStyle: CSSProperties = {
    width,
    height,
    ...(selected ? { borderColor: "rgba(255, 255, 255, 0.8)" } : {}),
    ...style,
  };

  return (
    <div className={shellCls} style={shellStyle}>
      <div className={previewCls} ref={previewRef as React.Ref<HTMLDivElement> | undefined}>
        {children}
      </div>
      {afterPreview}
    </div>
  );
}

export { NodeChromeShell };
export const NodeChromeShellMemo = memo(NodeChromeShell);
