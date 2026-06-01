import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyScriptDocumentImport,
  type ScriptDocumentExtract,
} from "@/lib/scriptDocument/importScriptDocument";
import type { ScriptDocumentAnalysis } from "@/lib/scriptDocument/scriptDocumentGaps";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  scriptNodeId: string;
  extract: ScriptDocumentExtract;
  analysis: ScriptDocumentAnalysis;
  onClose: () => void;
};

function gapClass(severity: ScriptDocumentAnalysis["gaps"][0]["severity"]): string {
  if (severity === "block") return "scriptDocGap--block";
  if (severity === "warn") return "scriptDocGap--warn";
  return "scriptDocGap--info";
}

export function ScriptDocumentImportDialog({
  scriptNodeId,
  extract,
  analysis,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const hasBlock = analysis.gaps.some((g) => g.severity === "block");

  const runImport = useCallback(
    async (parseAfter: boolean) => {
      setBusy(true);
      try {
        const result = await applyScriptDocumentImport({
          scriptNodeId,
          analysis,
          parseAfter,
        });
        setStatusText(result.message);
        if (result.ok) onClose();
      } finally {
        setBusy(false);
      }
    },
    [analysis, onClose, scriptNodeId, setStatusText],
  );

  const dialog = (
    <div className="scriptDocImportBackdrop" role="presentation" onClick={onClose}>
      <div
        className="scriptDocImportDialog"
        role="dialog"
        aria-labelledby="script-doc-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="scriptDocImportHead">
          <h2 id="script-doc-import-title">剧本导入 · 漏洞报告</h2>
          <p className="scriptDocImportMeta">
            {extract.fileName} · {extract.format.toUpperCase()} ·{" "}
            {analysis.charCount.toLocaleString()} 字
            {analysis.truncated ? "（将截断）" : ""}
          </p>
        </header>

        <ul className="scriptDocImportGaps">
          {analysis.gaps.map((gap) => (
            <li key={gap.id} className={`scriptDocGap ${gapClass(gap.severity)}`}>
              {gap.message}
            </li>
          ))}
        </ul>

        <p className="scriptDocImportHint">
          导入后：有上游文本连线则写入文本节点；否则写入脚本底栏。选择「导入并解析」将调用与「AI
          解析」相同的分镜表生成流程。
        </p>

        <footer className="scriptDocImportActions">
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={busy || hasBlock}
            onClick={() => void runImport(false)}
          >
            仅导入
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={busy || hasBlock}
            onClick={() => void runImport(true)}
          >
            导入并解析
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
