import fs from "fs";
import { execSync } from "child_process";

const dst = "d:/vibevideo/src/components/nodes/ImageGenerationPanel.tsx";
let s = fs.readFileSync(dst, "utf8");

if (!s.includes("风格")) {
  execSync("node d:/vibevideo/scripts/patch-image-gen-panel.mjs", { stdio: "inherit" });
  execSync("node d:/vibevideo/scripts/patch-igp-p0-meta.mjs", { stdio: "inherit" });
  s = fs.readFileSync(dst, "utf8");
}

if (s.includes("igp-prompt-wrap")) {
  s = s.replaceAll("<motionless", "<div").replaceAll("</motionless>", "</motionless>");
  fs.writeFileSync(dst, s, "utf8");
  console.log("fixed motionless tags");
  process.exit(0);
}

const block = `      {/* ── 提示词 ── */}
      <div className="igp-prompt-wrap">
        <MentionInput
          ref={mentionRef}
          nodeId={nodeId}
          value={prompt}
          onChange={setPrompt}
          placeholder="描述你想要生成的内容，使用 @可快速引用上传的文件，按 / 呼出指令"
          className={textareaClass}
          nodeLabels={nodeLabels}
          onSlashTrigger={handleSlashTrigger}
        />
        <span className="igp-counter" aria-live="polite">
          {prompt.length}/{IMAGE_GENERATION_PROMPT_MAX_CHARS}
        </span>
      </div>`;

let next = s.replace(
  /      \{\/\* ── 提示词 ── \*\/\}\n      <MentionInput[\s\S]*?\/>\n      \{slashCursorRect/,
  `${block}\n      {slashCursorRect`,
);

if (!next.includes("igp-prompt-wrap")) {
  next = s.replace(
    /      \{\/\* [\s\S]*? \*\/\}\n      <(?:div|motionless)[\s\S]*?igp-prompt-wrap[\s\S]*?\n      \{slashCursorRect/,
    `${block}\n      {slashCursorRect`,
  );
}

if (!next.includes("igp-prompt-wrap")) {
  console.error("replace failed");
  process.exit(1);
}

fs.writeFileSync(dst, next, "utf8");
console.log("ok");
