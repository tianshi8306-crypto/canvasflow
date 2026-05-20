import fs from "fs";

const p = "d:/vibevideo/scripts/patch-image-gen-panel.mjs";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
lines[74] =
  '  /      \\{/\\* ── 底栏参数 ── \\*\\/\\}\\n      <div className="igp-bottom-bar">[\\s\\S]*?      <\\/motionless>\\n    <\\/motionless>\\n  \\);\\n\\}/,'
    .replaceAll("motionless", "div");
fs.writeFileSync(p, lines.join("\n"));
console.log(lines[74]);
