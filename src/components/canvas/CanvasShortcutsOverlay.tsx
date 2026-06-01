import type { ReactNode } from "react";
import {
  buildCanvasShortcutColumns,
  type ShortcutBinding,
  type ShortcutEntry,
} from "@/lib/canvasShortcutCatalog";
import { formatShortcutParts } from "@/lib/canvasModKeys";

function isKbdPart(part: string): boolean {
  if (/[\u4e00-\u9fff]/.test(part)) return false;
  if (part.includes("拖") || part.includes("滚") || part === "·") return false;
  return part.length <= 8;
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="canvasShortcutKbd">{children}</kbd>;
}

function BindingView({ binding }: { binding: ShortcutBinding }) {
  if (binding.kind === "hint") {
    return <span className="canvasShortcutHint">{binding.text}</span>;
  }
  const parts = formatShortcutParts(binding.tokens);
  return (
    <span className="canvasShortcutCombo">
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="canvasShortcutCombo__part">
          {i > 0 ? <span className="canvasShortcutPlus">+</span> : null}
          {isKbdPart(p) ? <Kbd>{p}</Kbd> : <span className="canvasShortcutToken">{p}</span>}
        </span>
      ))}
    </span>
  );
}

function Col({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="canvasShortcutCol">
      <h3 className="canvasShortcutCol__title">{title}</h3>
      <div className="canvasShortcutCol__rows">{children}</div>
    </section>
  );
}

function Row({ entry }: { entry: ShortcutEntry }) {
  return (
    <div className="canvasShortcutRow">
      <span className="canvasShortcutRow__label">{entry.label}</span>
      <div className="canvasShortcutRow__binding">
        <BindingView binding={entry.binding} />
      </div>
    </div>
  );
}

type Props = {
  onClose: () => void;
};

export function CanvasShortcutsOverlay({ onClose }: Props) {
  const columns = buildCanvasShortcutColumns();

  return (
    <div
      className="canvasShortcutsOverlayRoot"
      role="dialog"
      aria-modal="true"
      aria-label="快捷键说明"
    >
      <button type="button" className="canvasShortcutsOverlayBackdrop" aria-label="关闭" onClick={onClose} />
      <div className="canvasShortcutsOverlayCard">
        <header className="canvasShortcutsOverlayHeader">
          <div className="canvasShortcutsOverlayHeaderText">
            <h2 className="canvasShortcutsOverlayTitle">快捷键</h2>
            <p className="canvasShortcutsOverlaySubtitle">画布常用操作速查</p>
          </div>
          <button
            type="button"
            className="canvasShortcutsOverlayClose"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="canvasShortcutsOverlayGrid">
          {columns.map((col) => (
            <Col key={col.id} title={col.title}>
              {col.entries.map((entry) => (
                <Row key={entry.id} entry={entry} />
              ))}
            </Col>
          ))}
        </div>
      </div>
    </div>
  );
}
