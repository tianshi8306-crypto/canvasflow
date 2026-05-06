import type { RefObject } from "react";

type Props = {
  importFileRef: RefObject<HTMLInputElement>;
  onImportFile: (file: File | null) => void;
  onExport: () => void;
  onClose: () => void;
};

export function SettingsHeaderBar({ importFileRef, onImportFile, onExport, onClose }: Props) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 750, fontSize: 16 }}>设置</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => importFileRef.current?.click()}>
            导入 JSON
          </button>
          <button type="button" className="btn" onClick={onExport}>
            导出 JSON
          </button>
          <button type="button" className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
      <input
        ref={importFileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => onImportFile(e.currentTarget.files?.[0] ?? null)}
      />
      <div style={{ height: 12 }} />
    </>
  );
}
