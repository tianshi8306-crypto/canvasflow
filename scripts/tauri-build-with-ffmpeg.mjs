import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const TAURI_DIR = path.join(ROOT, "src-tauri");
const TAURI_CONF = path.join(TAURI_DIR, "tauri.conf.json");
const BIN_DIR = path.join(TAURI_DIR, "bin");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function resolveCmd(cmd) {
  if (process.platform === "win32") {
    if (cmd === "npm") return "npm.cmd";
    if (cmd === "npx") return "npx.cmd";
  }
  return cmd;
}

function run(cmd, args, opts = {}) {
  const resolved = resolveCmd(cmd);
  const useShell = process.platform === "win32" && resolved.endsWith(".cmd");
  const r = spawnSync(resolved, args, {
    stdio: "inherit",
    shell: useShell,
    ...opts,
  });
  if (r.error) throw r.error;
  if (typeof r.status === "number" && r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with ${r.status}`);
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeJson(p, v) {
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function platformKey() {
  const p = os.platform();
  const a = os.arch();
  return `${p}-${a}`;
}

function ffmpegExeName() {
  return os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg";
}

function getDownloadPlan() {
  const key = platformKey();
  const inCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

  if (inCi && (key === "linux-x64" || key === "darwin-arm64" || key === "darwin-x64")) {
    return {
      kind: "system",
      url: "",
      extractHint: "CI：从系统 PATH / Homebrew 复制 ffmpeg",
    };
  }

  // 说明：
  // - 这里的 URL 可能会随上游变动；若下载失败，请手动放置 ffmpeg 到 src-tauri/bin/ 并重试。
  if (key === "win32-x64") {
    return {
      kind: "zip",
      // BtbN builds (GitHub Release)
      url: "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
      // zip 内通常包含 .../bin/ffmpeg.exe
      extractHint: "在 zip 内查找 bin/ffmpeg.exe",
    };
  }
  if (key === "darwin-arm64") {
    return {
      kind: "manual",
      url: "",
      extractHint: "请用 brew 安装 ffmpeg 后复制到 src-tauri/bin/ffmpeg（或在 CI 中放置静态二进制）",
    };
  }
  if (key === "darwin-x64") {
    return {
      kind: "manual",
      url: "",
      extractHint: "请用 brew 安装 ffmpeg 后复制到 src-tauri/bin/ffmpeg（或在 CI 中放置静态二进制）",
    };
  }
  if (key === "linux-x64") {
    return {
      kind: "manual",
      url: "",
      extractHint: "请使用发行版包管理器安装 ffmpeg 后复制到 src-tauri/bin/ffmpeg（或在 CI 中放置静态二进制）",
    };
  }
  return { kind: "manual", url: "", extractHint: "当前平台未内置下载方案，请手动放置 ffmpeg" };
}

function downloadFile(url, outPath) {
  if (!url) die("缺少下载 URL");
  console.log(`[ffmpeg] downloading to ${outPath}`);
  if (os.platform() === "win32") {
    // 使用 PowerShell（系统自带）
    run("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Invoke-WebRequest -Uri "${url}" -OutFile "${outPath}"`,
    ]);
  } else {
    // mac/linux：优先 curl
    run("bash", ["-lc", `curl -L --fail "${url}" -o "${outPath}"`]);
  }
}

function findFileRecursive(dir, fileName) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && e.name.toLowerCase() === fileName.toLowerCase()) return p;
    }
  }
  return null;
}

function copySystemFfmpeg(target) {
  if (os.platform() === "linux") {
    run("bash", ["-lc", `cp "$(command -v ffmpeg)" "${target}" && chmod +x "${target}"`]);
    return target;
  }
  if (os.platform() === "darwin") {
    run("bash", [
      "-lc",
      `FFMPEG="$(brew --prefix ffmpeg 2>/dev/null)/bin/ffmpeg"; if [ ! -x "$FFMPEG" ]; then FFMPEG="$(command -v ffmpeg)"; fi; cp "$FFMPEG" "${target}" && chmod +x "${target}"`,
    ]);
    return target;
  }
  die("[ffmpeg] CI system copy unsupported on this platform");
}

function patchTauriExternalBinPermanent() {
  if (!exists(TAURI_CONF)) die(`[tauri] missing ${TAURI_CONF}`);
  const conf = readJson(TAURI_CONF);
  conf.bundle = conf.bundle ?? {};
  conf.bundle.externalBin = ["bin/ffmpeg"];
  writeJson(TAURI_CONF, conf);
  console.log("[tauri] patched tauri.conf.json (externalBin enabled, permanent for CI)");
}

function ciTargetTriples() {
  const key = platformKey();
  if (key === "darwin-arm64") {
    return ["aarch64-apple-darwin", "x86_64-apple-darwin"];
  }
  if (key === "darwin-x64") {
    return ["x86_64-apple-darwin"];
  }
  if (key === "linux-x64") {
    return ["x86_64-unknown-linux-gnu"];
  }
  if (key === "win32-x64") {
    return ["x86_64-pc-windows-msvc"];
  }
  return [];
}

function ensureCiTargetCopies(baseBin) {
  const triples = ciTargetTriples();
  if (!triples.length) return;
  const ext = os.platform() === "win32" ? ".exe" : "";
  const baseName = path.basename(baseBin, ext);
  const dir = path.dirname(baseBin);
  for (const triple of triples) {
    const suffixed = path.join(dir, `${baseName}-${triple}${ext}`);
    if (!exists(suffixed)) {
      fs.copyFileSync(baseBin, suffixed);
      if (os.platform() !== "win32") fs.chmodSync(suffixed, 0o755);
      console.log(`[ffmpeg] copied ${baseBin} → ${suffixed}`);
    }
  }
}

function ensureBundledFfmpeg() {
  ensureDir(BIN_DIR);
  const exe = ffmpegExeName();
  const target = path.join(BIN_DIR, exe);
  if (exists(target)) {
    console.log(`[ffmpeg] found ${target}`);
    return target;
  }

  const plan = getDownloadPlan();
  if (plan.kind === "system") {
    copySystemFfmpeg(target);
    console.log(`[ffmpeg] installed ${target} from system`);
    return target;
  }
  if (plan.kind === "manual") {
    die(
      `[ffmpeg] 未找到 ${target}。\n` +
        `请手动放置 ffmpeg 后重试。\n` +
        (plan.extractHint ? `提示：${plan.extractHint}\n` : ""),
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "canvasflow-ffmpeg-"));
  const archive = path.join(tmpDir, plan.kind === "zip" ? "ffmpeg.zip" : "ffmpeg.tar");
  downloadFile(plan.url, archive);

  if (os.platform() === "win32") {
    run("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Expand-Archive -Path "${archive}" -DestinationPath "${tmpDir}" -Force`,
    ]);
  } else {
    die("[ffmpeg] 当前平台未实现自动解压，请手动放置 ffmpeg");
  }

  const found = findFileRecursive(tmpDir, exe);
  if (!found) die(`[ffmpeg] 解压后未找到 ${exe}。${plan.extractHint ?? ""}`);
  fs.copyFileSync(found, target);
  if (os.platform() !== "win32") fs.chmodSync(target, 0o755);
  console.log(`[ffmpeg] installed ${target}`);
  return target;
}

function withPatchedTauriConf(fn) {
  if (!exists(TAURI_CONF)) die(`[tauri] missing ${TAURI_CONF}`);
  const raw = fs.readFileSync(TAURI_CONF, "utf-8");
  const backup = `${TAURI_CONF}.bak`;
  fs.writeFileSync(backup, raw);

  const restore = () => {
    try {
      fs.writeFileSync(TAURI_CONF, raw);
      fs.unlinkSync(backup);
      console.log("[tauri] restored tauri.conf.json");
    } catch {
      // ignore
    }
  };

  const onExit = () => restore();
  process.on("SIGINT", () => {
    restore();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    restore();
    process.exit(143);
  });
  process.on("exit", onExit);

  const conf = JSON.parse(raw);
  conf.bundle = conf.bundle ?? {};
  conf.bundle.externalBin = ["bin/ffmpeg"];
  writeJson(TAURI_CONF, conf);
  console.log("[tauri] patched tauri.conf.json (externalBin enabled)");

  try {
    fn();
  } finally {
    restore();
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--print-plan")) {
    const exe = ffmpegExeName();
    const target = path.join(BIN_DIR, exe);
    const plan = getDownloadPlan();
    console.log(
      JSON.stringify(
        {
          platform: platformKey(),
          expectedBinPath: target,
          alreadyPresent: exists(target),
          downloadKind: plan.kind,
          downloadUrl: plan.url || null,
          hint: plan.extractHint || null,
        },
        null,
        2,
      ),
    );
    return;
  }

  ensureBundledFfmpeg();
  ensureCiTargetCopies(path.join(BIN_DIR, ffmpegExeName()));

  if (args.has("--ci-prep")) {
    patchTauriExternalBinPermanent();
    console.log("[tauri] CI release prep complete");
    return;
  }

  if (args.has("--skip-build")) {
    console.log("[tauri] --skip-build set, ffmpeg prepared only");
    return;
  }

  withPatchedTauriConf(() => {
    // 直接调用 tauri build（会先跑 package.json 的 build）
    run("npm", ["run", "tauri", "build"]);
  });
}

main();

