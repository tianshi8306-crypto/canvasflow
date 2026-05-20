import type { ReactNode } from "react";

function canvasModHints(): {
  copy: string;
  paste: string;
  del: string;
  undo: string;
  redo: string;
  group: string;
} {
  const mac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform ?? "");
  return {
    copy: mac ? "⌘C" : "Ctrl+C",
    paste: mac ? "⌘V" : "Ctrl+V",
    del: mac ? "⌫" : "Delete",
    undo: mac ? "⌘Z" : "Ctrl+Z",
    redo: mac ? "⇧⌘Z" : "Ctrl+Shift+Z",
    group: mac ? "⌘G" : "Ctrl+G",
  };
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="canvasShortcutKbd">{children}</kbd>;
}

function KbdCombo({ parts }: { parts: ReactNode[] }) {
  return (
    <span className="canvasShortcutCombo">
      {parts.map((p, i) => (
        <span key={i} className="canvasShortcutCombo__part">
          {i > 0 ? <span className="canvasShortcutPlus">+</span> : null}
          {p}
        </span>
      ))}
    </span>
  );
}

function Col({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="canvasShortcutCol">
      <div className="canvasShortcutCol__title">{title}</div>
      <div className="canvasShortcutCol__rows">{children}</div>
    </div>
  );
}

function Row({ label, right }: { label: string; right: ReactNode }) {
  return (
    <div className="canvasShortcutRow">
      <span className="canvasShortcutRow__label">{label}</span>
      <div className="canvasShortcutRow__right">{right}</div>
    </div>
  );
}

type Props = {
  onClose: () => void;
};

export function CanvasShortcutsOverlay({ onClose }: Props) {
  const m = canvasModHints();

  return (
    <div
      className="canvasShortcutsOverlayRoot"
      role="dialog"
      aria-modal="true"
      aria-label="快捷键说明"
    >
      <button type="button" className="canvasShortcutsOverlayBackdrop" aria-label="关闭" onClick={onClose} />
      <div className="canvasShortcutsOverlayCard">
        <button type="button" className="canvasShortcutsOverlayClose" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <div className="canvasShortcutsOverlayGrid">
          <Col title="画布">
            <Row
              label="双击空白添加节点"
              right={<span className="canvasShortcutHint">打开添加面板</span>}
            />
            <Row
              label="双击节点"
              right={<span className="canvasShortcutHint">适配视野居中</span>}
            />
            <Row
              label="框选多节点"
              right={
                <span className="canvasShortcutHint">
                  空白处拖拽 / Shift 点选
                </span>
              }
            />
            <Row
              label="平移画布"
              right={
                <KbdCombo
                  parts={[<Kbd key="s">Space</Kbd>, <span key="m">左键拖拽</span>]}
                />
              }
            />
            <Row
              label="右键框选"
              right={<span className="canvasShortcutHint">画布空白处按住右键拖选</span>}
            />
          </Col>

          <Col title="缩放">
            <Row label="聚焦选中节点" right={<Kbd>F</Kbd>} />
            <Row label="适配全部节点" right={<Kbd>Z</Kbd>} />
            <Row
              label="滚轮"
              right={<span className="canvasShortcutHint">在画布上滚动</span>}
            />
            <Row
              label="左下角滑块"
              right={<span className="canvasShortcutHint">调节缩放</span>}
            />
          </Col>

          <Col title="整理与工具">
            <Row
              label="整理画布"
              right={
                <KbdCombo
                  parts={[
                    <Kbd key="a">Alt</Kbd>,
                    <Kbd key="s">Shift</Kbd>,
                    <Kbd key="f">F</Kbd>,
                  ]}
                />
              }
            />
            <Row
              label="小地图开关"
              right={
                <KbdCombo
                  parts={[
                    <Kbd key="a">Alt</Kbd>,
                    <Kbd key="s">Shift</Kbd>,
                    <Kbd key="m">M</Kbd>,
                  ]}
                />
              }
            />
            <Row
              label="对齐吸附开关"
              right={
                <KbdCombo
                  parts={[
                    <Kbd key="a">Alt</Kbd>,
                    <Kbd key="s">Shift</Kbd>,
                    <Kbd key="x">S</Kbd>,
                  ]}
                />
              }
            />
          </Col>

          <Col title="编辑">
            <Row label="撤销" right={<Kbd>{m.undo}</Kbd>} />
            <Row label="重做" right={<Kbd>{m.redo}</Kbd>} />
            <Row label="删除选中" right={<Kbd>{m.del}</Kbd>} />
            <Row label="复制" right={<Kbd>{m.copy}</Kbd>} />
            <Row label="粘贴" right={<Kbd>{m.paste}</Kbd>} />
            <Row label="打组" right={<Kbd>{m.group}</Kbd>} />
          </Col>
        </div>
      </div>
    </div>
  );
}
