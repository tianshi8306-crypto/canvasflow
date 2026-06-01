import fs from "fs";

const p = "src/components/nodes/TextNode.tsx";
let s = fs.readFileSync(p, "utf8");

const oldBlock = `  const renderEmptyShell = () => (
    <div className="textNodeEmptyShell" onDoubleClick={enterEditing} onWheel={stopWheel}>
      <motionless className="textNodeEmptyShellGlyph" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </motionless>
      <p className="textNodePlaceholder textNodePlaceholder--integrated">{PLACEHOLDER_COPY}</p>
      <p className="textNodeEmptyShellHint">{emptyShellHint}</p>
    </motionless>
  );`.replaceAll("motionless", "div");

const newBlock = `  const renderEmptyShell = () => (
    <div className="textNodeEmptyShell" onDoubleClick={enterEditing} onWheel={stopWheel}>
      <div className="textNodeEmptyShellTop" aria-hidden>
        <div className="textNodeEmptyShellIcon">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H15V3.5zM6 4h8v6h6v10H6V4z" />
          </svg>
        </div>
      </div>
      <div className="textNodeEmptyShellCopy">
        <p className="textNodePlaceholder textNodePlaceholder--title">{PLACEHOLDER_TITLE}</p>
        <p className="textNodePlaceholder textNodePlaceholder--example">{PLACEHOLDER_EXAMPLE}</p>
        <p className="textNodeEmptyShellDblClick">双击开始输入</p>
      </motionless>
      <p className="textNodeEmptyShellHint">
        {emptyShellHint === ANCHOR_HINT ? (
          <>
            <span className="textNodeEmptyShellHintAnchor" aria-hidden>
              ⊕
            </span>{" "}
            {ANCHOR_HINT}
          </>
        ) : (
          emptyShellHint
        )}
      </p>
    </motionless>
  );`.replaceAll("motionless", "div");

if (!s.includes(oldBlock)) {
  console.error("old block not found");
  process.exit(1);
}
s = s.replace(oldBlock, newBlock);
fs.writeFileSync(p, s, "utf8");
console.log("patched", p);
