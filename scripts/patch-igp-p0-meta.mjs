import fs from "fs";

const dst = "d:/vibevideo/src/components/nodes/ImageGenerationPanel.tsx";
let s = fs.readFileSync(dst, "utf8");

if (s.includes("function IgpTaskMetaTile")) {
  console.log("skip: already patched");
  process.exit(0);
}

s = s.replace(
  'import { imageTaskStatusLabel } from "@/lib/imageGeneration/detectImageTask";',
  `import {
  imageTaskMetaChipLabel,
  imageTaskStatusLabel,
} from "@/lib/imageGeneration/detectImageTask";`,
);

s = s.replace(
  '  type ImageStyleId,\n} from "@/lib/imageGeneration/catalog";',
  '  type ImageStyleId,\n  type ImageTaskMode,\n} from "@/lib/imageGeneration/catalog";',
);

const metaComponents = `/** 任务模式：文生图 / 参考（只读，无角标 +） */
function IconTaskMeta({ hasReference }: { hasReference: boolean }) {
  if (hasReference) {
    return (
      <svg className="igp-meta-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="4.5"
          y="6.5"
          width="9"
          height="9"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.35"
        />
        <rect
          x="10.5"
          y="8.5"
          width="9"
          height="9"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.35"
        />
      </svg>
    );
  }
  return (
    <svg className="igp-meta-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 14.2 9.3 20.5 9.8 15.8 13.9 17.2 20.1 12 16.8 6.8 20.1 8.2 13.9 3.5 9.8 9.8 9.3 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IgpTaskMetaTile({
  task,
  refCount,
}: {
  task?: ImageTaskMode;
  refCount: number;
}) {
  const title = task
    ? imageTaskStatusLabel(task, refCount)
    : refCount > 0
      ? \`\${refCount} 张参考已连接\`
      : "";
  const label = imageTaskMetaChipLabel(task, refCount);

  return (
    <div
      className="igp-icon-btn igp-meta-tile"
      title={title}
      aria-label={title}
    >
      <IconTaskMeta hasReference={refCount > 0} />
      <span>{label}</span>
    </div>
  );
}

`;

s = s.replace(
  /\/\*\* 标记：线框定位针 \+ 中心点 \+ 角标 \+ \*\/\nfunction IconMarker\(\) \{[\s\S]*?\n\}\n\n/,
  (m) => m + metaComponents,
);

const headerQuickBlock = `        <div className="igp-header-quick">
            <button
              ref={styleBtnRef}
              type="button"
              className={\`igp-icon-btn\${
                stylePopoverOpen || selectedStyleIds.length > 0 ? " active" : ""
              }\`}
              title="画风"
              onClick={() => setStylePopoverOpen((o) => !o)}
            >
              <IconStyle />
              <span>风格</span>
            </button>
            <button
              type="button"
              className={\`igp-icon-btn\${hasMarker ? " active" : ""}\`}
              title={hasMarker ? "取消画布标记" : "标记并定位到此节点"}
              onClick={handleMarkerClick}
            >
              <IconMarker />
              <span>{hasMarker ? "已标记" : "标记"}</span>
            </button>
            {(ctx.task || refCount > 0) ? (
              <IgpTaskMetaTile task={ctx.task} refCount={refCount} />
            ) : null}
          </div>`;

s = s.replace(
  /        \{isDockedLayout \? \(\n          <div className="igp-header-quick">[\s\S]*?          <\/div>\n        \) : null\}/,
  headerQuickBlock,
);

s = s.replace(
  /      \{\(ctx\.task \|\| refCount > 0\) \? \(\n        <motionless className="igp-toolbar-top">[\s\S]*?      \) : null\}\n\n      \{\/\* ── 提示词/,
  "      {/* ── 提示词",
);

s = s.replace(
  /      \{\(ctx\.task \|\| refCount > 0\) \? \(\n        <div className="igp-toolbar-top">[\s\S]*?      \) : null\}\n\n      \{\/\* ── 提示词/,
  "      {/* ── 提示词",
);

s = s.replace(
  /\n  const isDockedLayout = layout === "empty" \|\| layout === "expanded";\n/,
  "\n",
);

fs.writeFileSync(dst, s, "utf8");
const ok =
  s.includes("IgpTaskMetaTile") &&
  s.includes("igp-meta-tile") &&
  !s.includes("igp-toolbar-top") &&
  s.includes("风格") &&
  !s.includes("isDockedLayout");
console.log(ok ? "ok" : "check failed", s.split("\n").length);
