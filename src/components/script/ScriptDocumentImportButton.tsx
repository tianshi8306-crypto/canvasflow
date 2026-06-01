import { useCallback, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ScriptDocumentImportDialog } from "@/components/script/ScriptDocumentImportDialog";
import { pickAndAnalyzeScriptDocument } from "@/lib/scriptDocument/importScriptDocument";
import type { ScriptDocumentAnalysis } from "@/lib/scriptDocument/scriptDocumentGaps";
import type { ScriptDocumentExtract } from "@/lib/scriptDocument/importScriptDocument";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  scriptNodeId: string;
  disabled?: boolean;
  className?: string;
  title?: string;
};

export function ScriptDocumentImportButton({
  scriptNodeId,
  disabled,
  className,
  title = "上传剧本（txt / md / docx）",
}: Props) {
  const setStatusText = useProjectStore((s) => s.setStatusText);
  const [report, setReport] = useState<{
    extract: ScriptDocumentExtract;
    analysis: ScriptDocumentAnalysis;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (!isTauri()) {
      setStatusText(DESKTOP_SHELL_HINT);
      return;
    }
    setLoading(true);
    try {
      const result = await pickAndAnalyzeScriptDocument();
      if (result) setReport(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusText(`读取剧本失败：${msg}`);
    } finally {
      setLoading(false);
    }
  }, [setStatusText]);

  return (
    <>
      <button
        type="button"
        className={className ?? "btn btn--ghost btn--sm"}
        title={title}
        disabled={disabled || loading}
        onClick={() => void handleClick()}
      >
        {loading ? "读取中…" : "上传剧本"}
      </button>
      {report ? (
        <ScriptDocumentImportDialog
          scriptNodeId={scriptNodeId}
          extract={report.extract}
          analysis={report.analysis}
          onClose={() => setReport(null)}
        />
      ) : null}
    </>
  );
}
