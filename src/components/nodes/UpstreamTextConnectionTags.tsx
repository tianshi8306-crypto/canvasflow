import type { PointerEvent as ReactPointerEvent } from "react";
import { formatUpstreamTextCharCount } from "@/lib/scriptUpstreamText";

export type UpstreamTextConnectionTagItem = {
  nodeId: string;
  label: string;
  charCount?: number;
  /** 与视频参考条 @文本N 对齐；无则仅定位 */
  atToken?: string;
  glyph?: "文" | "剧";
  empty?: boolean;
  disabled?: boolean;
};

type Props = {
  items: UpstreamTextConnectionTagItem[];
  onLocate: (nodeId: string, label: string) => void;
  onInsertAtToken?: (token: string) => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
  className?: string;
  ariaLabel?: string;
};

function tagTitle(item: UpstreamTextConnectionTagItem): string {
  if (item.disabled) return "上游连线已禁用";
  if (item.empty) return `「${item.label}」正文为空，请先在文本节点写入剧本`;
  const parts = [item.label];
  if (item.charCount != null && item.charCount > 0) {
    parts.push(`${formatUpstreamTextCharCount(item.charCount)} 字`);
  }
  if (item.atToken) {
    parts.push(`${item.atToken} · Shift+单击插入`);
  }
  parts.push("单击定位");
  return parts.join(" · ");
}

/** 底栏内上游文本连线标签（对齐视频 mmThumb--text / 文本 tgp-upstream-text-tag） */
export function UpstreamTextConnectionTags({
  items,
  onLocate,
  onInsertAtToken,
  onPointerDown,
  className,
  ariaLabel = "上游文本连线",
}: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className={["tgp-upstream-text-tags", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const glyph = item.glyph ?? (item.atToken ? "文" : "文");
        return (
          <button
            key={item.nodeId}
            type="button"
            className={[
              "tgp-upstream-text-tag",
              item.empty ? "tgp-upstream-text-tag--empty" : "",
              item.disabled ? "tgp-upstream-text-tag--disabled" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={tagTitle(item)}
            disabled={item.disabled}
            onPointerDown={onPointerDown}
            onClick={(e) => {
              e.stopPropagation();
              if (item.disabled || item.empty) {
                onLocate(item.nodeId, item.label);
                return;
              }
              if (item.atToken && e.shiftKey && onInsertAtToken) {
                onInsertAtToken(item.atToken);
                return;
              }
              onLocate(item.nodeId, item.label);
            }}
          >
            <span className="tgp-upstream-text-tagGlyph" aria-hidden>
              {glyph}
            </span>
            <span className="tgp-upstream-text-tagLabel">{item.label}</span>
            {item.charCount != null && item.charCount > 0 ? (
              <span className="tgp-upstream-text-tagMeta">
                {formatUpstreamTextCharCount(item.charCount)}字
              </span>
            ) : item.empty ? (
              <span className="tgp-upstream-text-tagMeta">空</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
