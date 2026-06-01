import { useState } from "react";
import { useProjectAssetOrganize } from "@/hooks/useProjectAssetOrganize";

export function SettingsProjectAssetsSection() {
  const { projectPath, syncIndex, previewOrganize, executeOrganize } = useProjectAssetOrganize();
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="settingsSection">
      <div className="settingsSectionTitle">工程素材目录</div>
      <p className="settingsFieldHint" style={{ marginBottom: 12 }}>
        素材按<strong>类型</strong>放在 <code className="mono">assets/</code> 下一级目录，再分{" "}
        <code className="mono">import/</code>（导入）与 <code className="mono">gen/来源/</code>
        （AI 生成）。例如：
        <code className="mono"> assets/video/import/clip.mp4</code>、
        <code className="mono"> assets/image/gen/generate/…</code>。导出仍用{" "}
        <code className="mono">assets/exports/</code>。
      </p>

      {!projectPath ? (
        <p className="settingsFieldHint">请先打开工程后再整理素材目录。</p>
      ) : (
        <div className="settingsField">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn" disabled={busy} onClick={() => void syncIndex()}>
              同步素材索引
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void previewOrganize()
                  .then((result) => {
                    if (!result) {
                      setPreviewText(null);
                      return;
                    }
                    const lines = result.items
                      .filter((item) => !item.skipped)
                      .slice(0, 10)
                      .map((item) => `${item.oldRelPath} → ${item.newRelPath}`);
                    setPreviewText(
                      result.migratedCount === 0
                        ? "当前工程素材路径已符合规范。"
                        : `可整理 ${result.migratedCount} 项：\n${lines.join("\n")}${result.migratedCount > 10 ? "\n…" : ""}`,
                    );
                  })
                  .finally(() => setBusy(false));
              }}
            >
              预览整理
            </button>
            <button
              type="button"
              className="btn btnPrimary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void executeOrganize()
                  .then((result) => {
                    if (result && result.migratedCount > 0) setPreviewText(null);
                  })
                  .finally(() => setBusy(false));
              }}
            >
              整理素材目录
            </button>
          </div>
          <span className="settingsFieldHint">
            会移动磁盘文件、更新 runs.db 索引与 canvasflow.json，并刷新画布中的路径引用。整理后请保存工程。
          </span>
          {previewText ? (
            <pre
              className="mono"
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                color: "var(--muted)",
              }}
            >
              {previewText}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}
