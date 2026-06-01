import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { useProjectStore } from "@/store/projectStore";

export function TimelineLitePanel() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [clipsText, setClipsText] = useState("assets/a.mp4\nassets/b.mp4");
  const [output, setOutput] = useState("assets/exports/final.mp4");
  const [status, setStatus] = useState("");

  return (
    <div className="panelBody">
      <div style={{ fontWeight: 650 }}>轻量视频编辑</div>
      <div className="field">
        <label>片段（每行一个相对路径）</label>
        <textarea className="mono" value={clipsText} onChange={(e) => setClipsText(e.target.value)} />
      </div>
      <div className="field">
        <label>输出路径</label>
        <input className="mono" value={output} onChange={(e) => setOutput(e.target.value)} />
      </div>
      <button
        type="button"
        className="btn"
        disabled={!projectPath}
        onClick={async () => {
          if (!projectPath) return;
          const clips = clipsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          setStatus("正在合成…");
          try {
            const out = await invoke<string>("render_timeline", {
              projectPath,
              clips: clips.map((relPath) => ({ relPath, inSec: 0, outSec: null })),
              outputRelPath: output,
            });
            setStatus(`完成：${out}`);
          } catch (e) {
            setStatus(`失败：${String(e)}`);
          }
        }}
      >
        合成预览
      </button>
      {status ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{status}</div> : null}
    </div>
  );
}
