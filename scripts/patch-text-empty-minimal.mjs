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
    <div
      className="textNodeEmptyShell"
      onDoubleClick={enterEditing}
      onWheel={stopWheel}
      title={TEXT_EMPTY_PROMPT}
    >
      <div className="textNodeEmptyShellIcon" aria-hidden>
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
      </div>
      <p className="textNodeEmptyShellLabel">{TEXT_EMPTY_PROMPT}</p>
    </div>
  );

`;

s = s.slice(0, start) + newBlock + s.slice(end);
s = s.replaceAll("data-placeholder={PLACEHOLDER_COPY}", "data-placeholder={TEXT_EMPTY_PROMPT}");

fs.writeFileSync(p, s, "utf8");
console.log("patched", p);
