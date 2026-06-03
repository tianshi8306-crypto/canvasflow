#!/usr/bin/env node
/** 从 brand/app-icon.svg 生成 1024 PNG，供 `npx tauri icon` 使用 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "brand", "app-icon.svg");
const outPath = join(root, "brand", "app-icon-1024.png");

const sharp = (await import("sharp")).default;
const svg = readFileSync(svgPath);
await sharp(svg).resize(1024, 1024).png().toFile(outPath);
writeFileSync(join(root, "brand", ".generated"), `${new Date().toISOString()}\n`);
console.log(`Wrote ${outPath}`);
