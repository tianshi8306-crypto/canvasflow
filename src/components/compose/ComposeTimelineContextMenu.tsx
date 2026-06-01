import { useEffect } from "react";

export type ComposeContextMenuAction =
  | "split"
  | "trimIn"
  | "trimOut"
  | "locate"
  | "delete";

type Props = {
  x: number;
  y: number;
  canSplit: boolean;
  canTrimIn: boolean;
  canTrimOut: boolean;
  canLocate: boolean;
  canDelete: boolean;
  onAction: (action: ComposeContextMenuAction) => void;
  onClose: () => void;
};

export function ComposeTimelineContextMenu({
  x,
  y,
  canSplit,
  canTrimIn,
  canTrimOut,
  canLocate,
  canDelete,
  onAction,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="composeTimelineMenuBackdrop" role="presentation" onClick={onClose} />
      <div
        className="composeTimelineContextMenu"
        role="menu"
        style={{ left: x, top: y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          role="menuitem"
          disabled={!canSplit}
          onClick={() => onAction("split")}
        >
          在播放头分割
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canTrimIn}
          onClick={() => onAction("trimIn")}
        >
          修剪入点
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canTrimOut}
          onClick={() => onAction("trimOut")}
        >
          修剪出点
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canLocate}
          onClick={() => onAction("locate")}
        >
          定位源节点
        </button>
        <button
          type="button"
          role="menuitem"
          className="composeTimelineContextMenuItem--danger"
          disabled={!canDelete}
          onClick={() => onAction("delete")}
        >
          删除片段
        </button>
      </div>
    </>
  );
}
