import fs from "fs";

const p = "src/components/nodes/TextNode.tsx";
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf("  const renderEmptyShell = () => (");
const end = s.indexOf("  const renderBody = () => {", start);
if (start < 0 || end < 0) {
  console.error("markers not found");
  process.exit(1);
}

const newBlock = `  const renderEmptyShell = () => (
    <motionless className="textNodeEmptyShell" onDoubleClick={enterEditing} onWheel={stopWheel}>
      <motionless className="textNodeEmptyShellCenter">
        <motionless className="textNodeEmptyShellHero" aria-hidden>
          <motionless className="textNodeEmptyShellIcon">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M14 2v6h6M8 13h8M8 17h5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </motionless>
          <motionless className="textNodeEmptyShellCopy">
            <p className="textNodePlaceholder textNodePlaceholder--title">{PLACEHOLDER_TITLE}</p>
            <p className="textNodePlaceholder textNodePlaceholder--example">{PLACEHOLDER_EXAMPLE}</p>
          </motionless>
        </motionless>
        <p className="textNodeEmptyShellDblClick">双击开始输入</p>
      </motionless>
      <p className="textNodeEmptyShellHint">
        {emptyShellHint === ANCHOR_HINT ? (
          <>
            <span className="textNodeEmptyShellHintAnchor" aria-hidden>
              <svg viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 2.5v7M2.5 6h7"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            {ANCHOR_HINT}
          </>
        ) : (
          emptyShellHint
        )}
      </p>
    </motionless>
  );

`.replaceAll("motionless", "div");

s = s.slice(0, start) + newBlock + s.slice(end);
fs.writeFileSync(p, s, "utf8");
console.log("patched layout");
