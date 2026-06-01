import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  computeScriptVersionVisualDiff,
  filterScriptVersionDiffRows,
  formatScriptVersionVisualDiffSummary,
  type ScriptVersionRowDiff,
} from "@/lib/hermes/agent/hermesScriptVersionDiff";
import {
  listScriptVersionsForNode,
  loadHermesScriptVersions,
  resolvePrimaryScriptNodeId,
  rollbackScriptVersion,
  type HermesScriptVersionEntry,
} from "@/lib/hermes/agent/hermesScriptVersion";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import "./HermesScriptVersionDiffOverlay.css";

function formatVersionOption(e: HermesScriptVersionEntry): string {
  const when = e.createdAt.slice(0, 16).replace("T", " ");
  return `${when} · ${e.label} · ${e.beatCount}/${e.shotCount} · ${e.id.slice(0, 10)}`;
}

function DiffRowList({ title, rows }: { title: string; rows: ScriptVersionRowDiff[] }) {
  const visible = filterScriptVersionDiffRows(rows);
  if (visible.length === 0) return null;
  return (
    <section className="hermesScriptDiffSection">
      <h4 className="hermesScriptDiffSectionTitle">{title}</h4>
      <ul className="hermesScriptDiffList">
        {visible.map((row) => (
          <li
            key={row.key}
            className={`hermesScriptDiffRow hermesScriptDiffRow--${row.kind}`}
          >
            <div className="hermesScriptDiffRowHead">
              <span className="hermesScriptDiffKind">
                {row.kind === "added"
                  ? "新增"
                  : row.kind === "removed"
                    ? "删除"
                    : "变更"}
              </span>
              <span className="hermesScriptDiffRowTitle">{row.title}</span>
            </div>
            {row.fields.length > 0 ? (
              <dl className="hermesScriptDiffFields">
                {row.fields.map((f) => (
                  <div key={`${row.key}-${f.field}`} className="hermesScriptDiffField">
                    <dt>{f.label}</dt>
                    <dd>
                      {row.kind === "added" ? (
                        <span className="hermesScriptDiffAfter">{f.after || "—"}</span>
                      ) : row.kind === "removed" ? (
                        <span className="hermesScriptDiffBefore">{f.before || "—"}</span>
                      ) : (
                        <>
                          <span className="hermesScriptDiffBefore">{f.before || "—"}</span>
                          <span className="hermesScriptDiffArrow">→</span>
                          <span className="hermesScriptDiffAfter">{f.after || "—"}</span>
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HermesScriptVersionDiffOverlay() {
  const open = useCanvasUiStore((s) => s.scriptVersionDiffOpen);
  const preset = useCanvasUiStore((s) => s.scriptVersionDiffPreset);
  const closeScriptVersionDiff = useCanvasUiStore((s) => s.closeScriptVersionDiff);

  const projectPath = useProjectStore((s) => s.projectPath);
  const nodes = useProjectStore((s) => s.nodes);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const scriptNodeId = useMemo(() => resolvePrimaryScriptNodeId(nodes), [nodes]);

  const [entries, setEntries] = useState<HermesScriptVersionEntry[]>([]);
  const [olderId, setOlderId] = useState<string>("");
  const [newerId, setNewerId] = useState<string>("");
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!open || !projectPath || !scriptNodeId || !isTauri()) {
      setEntries([]);
      return;
    }
    void loadHermesScriptVersions(projectPath).then((store) => {
      const list = listScriptVersionsForNode(store, scriptNodeId);
      setEntries(list);
      if (list.length >= 2) {
        const newer = preset?.newerVersionId
          ? list.find((e) => e.id.startsWith(preset.newerVersionId!)) ?? list[list.length - 1]
          : list[list.length - 1];
        const older = preset?.olderVersionId
          ? list.find((e) => e.id.startsWith(preset.olderVersionId!)) ?? list[list.length - 2]
          : list[list.length - 2];
        setNewerId(newer!.id);
        setOlderId(older!.id);
      } else if (list.length === 1) {
        setNewerId(list[0]!.id);
        setOlderId(list[0]!.id);
      }
    });
  }, [open, projectPath, scriptNodeId, preset?.olderVersionId, preset?.newerVersionId]);

  const olderEntry = entries.find((e) => e.id === olderId);
  const newerEntry = entries.find((e) => e.id === newerId);

  const diff = useMemo(() => {
    if (!olderEntry || !newerEntry || olderId === newerId) return null;
    return computeScriptVersionVisualDiff(olderEntry.payload, newerEntry.payload);
  }, [olderEntry, newerEntry, olderId, newerId]);

  const handleRollbackOlder = useCallback(async () => {
    if (!projectPath || !scriptNodeId || !olderEntry || rolling) return;
    setRolling(true);
    try {
      const result = await rollbackScriptVersion({
        projectPath,
        scriptNodeId,
        versionIdPrefix: olderEntry.id,
      });
      setStatusText(result.message);
      if (result.ok) closeScriptVersionDiff();
    } finally {
      setRolling(false);
    }
  }, [projectPath, scriptNodeId, olderEntry, rolling, setStatusText, closeScriptVersionDiff]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeScriptVersionDiff();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeScriptVersionDiff]);

  if (!open) return null;

  return (
    <>
      <div
        className="hermesScriptDiffOverlayBackdrop"
        onClick={closeScriptVersionDiff}
        aria-hidden
      />
      <div
        className="hermesScriptDiffOverlay"
        role="dialog"
        aria-modal="true"
        aria-label="脚本版本对比"
      >
        <header className="hermesScriptDiffHeader">
          <div>
            <h3 className="hermesScriptDiffTitle">脚本 / 分镜版本对比</h3>
            <p className="hermesScriptDiffSubtitle">
              对比历史快照与当前存档；回滚会覆盖画布脚本节点内容。
            </p>
          </div>
          <button
            type="button"
            className="hermesScriptDiffClose"
            aria-label="关闭"
            onClick={closeScriptVersionDiff}
          >
            ×
          </button>
        </header>

        {!isTauri() ? (
          <p className="hermesScriptDiffEmpty">{DESKTOP_SHELL_HINT}</p>
        ) : entries.length < 2 ? (
          <p className="hermesScriptDiffEmpty">
            至少需要 2 个版本快照。Agent 改脚本/分镜成功后会自动存档。
          </p>
        ) : (
          <div className="hermesScriptDiffBody">
            <>
            <div className="hermesScriptDiffPickers">
              <label className="hermesScriptDiffPicker">
                <span>旧版</span>
                <select
                  value={olderId}
                  onChange={(e) => setOlderId(e.target.value)}
                >
                  {entries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatVersionOption(e)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hermesScriptDiffPicker">
                <span>新版</span>
                <select
                  value={newerId}
                  onChange={(e) => setNewerId(e.target.value)}
                >
                  {entries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatVersionOption(e)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {diff ? (
              <>
                <p className="hermesScriptDiffSummary">
                  {formatScriptVersionVisualDiffSummary(diff)}
                </p>

                {diff.briefChanged ? (
                  <section className="hermesScriptDiffSection">
                    <h4 className="hermesScriptDiffSectionTitle">梗概</h4>
                    <div className="hermesScriptDiffBrief">
                      <div>
                        <span className="hermesScriptDiffBriefLabel">旧</span>
                        <p>{diff.briefBefore || "—"}</p>
                      </div>
                      <div>
                        <span className="hermesScriptDiffBriefLabel">新</span>
                        <p>{diff.briefAfter || "—"}</p>
                      </div>
                    </div>
                  </section>
                ) : null}

                <DiffRowList title="镜头表" rows={diff.beatRows} />
                <DiffRowList title="分镜" rows={diff.shotRows} />

                {filterScriptVersionDiffRows(diff.beatRows).length === 0 &&
                filterScriptVersionDiffRows(diff.shotRows).length === 0 &&
                !diff.briefChanged ? (
                  <p className="hermesScriptDiffEmpty">两版内容相同或差异极微。</p>
                ) : null}
              </>
            ) : (
              <p className="hermesScriptDiffEmpty">请选择两个不同版本。</p>
            )}

            <footer className="hermesScriptDiffFooter">
              <button
                type="button"
                className="btn btnSecondary"
                disabled={!olderEntry || rolling}
                onClick={() => void handleRollbackOlder()}
              >
                回滚到旧版
              </button>
              <button type="button" className="btn btnPrimary" onClick={closeScriptVersionDiff}>
                关闭
              </button>
            </footer>
            </>
          </div>
        )}
      </div>
    </>
  );
}
