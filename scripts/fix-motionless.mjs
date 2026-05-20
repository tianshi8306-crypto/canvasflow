import fs from "fs";

const p = process.argv[2];
if (!p) {
  console.error("usage: node fix-motionless.mjs <file>");
  process.exit(1);
}
const TAG = String.fromCharCode(109, 111, 116, 105, 111, 110, 108, 101, 115, 115);
let s = fs.readFileSync(p, "utf8");
const before = s;
s = s.replaceAll(`<${TAG}`, "<div");
s = s.replaceAll(`</${TAG}>`, "</div>");
if (s === before) {
  console.log("no change", p);
} else {
  fs.writeFileSync(p, s, "utf8");
  console.log("fixed", p);
}
