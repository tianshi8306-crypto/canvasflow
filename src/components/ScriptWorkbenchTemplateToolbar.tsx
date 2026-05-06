import type { RefObject } from "react";
import type { ScriptTemplateItem } from "@/lib/scriptWorkbenchTypes";

type StyleOption = { label: string; value: string };

type Props = {
  templateStyleFilter: string;
  setTemplateStyleFilter: (value: string) => void;
  templateStyleOptions: readonly StyleOption[];
  templateQuery: string;
  setTemplateQuery: (value: string) => void;
  templateId: string;
  setTemplateId: (value: string) => void;
  filteredTemplates: ScriptTemplateItem[];
  templatesCount: number;
  saveCurrentAsTemplate: () => void;
  applyTemplate: () => void;
  deleteTemplate: () => void;
  exportTemplates: () => void;
  importPresetTemplatePack: () => void;
  templateImportInputRef: RefObject<HTMLInputElement>;
  importTemplatesFromFile: (file: File) => void;
};

export function ScriptWorkbenchTemplateToolbar({
  templateStyleFilter,
  setTemplateStyleFilter,
  templateStyleOptions,
  templateQuery,
  setTemplateQuery,
  templateId,
  setTemplateId,
  filteredTemplates,
  templatesCount,
  saveCurrentAsTemplate,
  applyTemplate,
  deleteTemplate,
  exportTemplates,
  importPresetTemplatePack,
  templateImportInputRef,
  importTemplatesFromFile,
}: Props) {
  return (
    <div className="scriptToolbarGroup">
      <select
        className="scriptTemplateSelect"
        value={templateStyleFilter}
        onChange={(e) => {
          setTemplateStyleFilter(e.target.value);
          setTemplateId("");
        }}
        title="按模板风格筛选"
      >
        {templateStyleOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        className="scriptTemplateSearchInput"
        value={templateQuery}
        onChange={(e) => {
          setTemplateQuery(e.target.value);
          setTemplateId("");
        }}
        placeholder="搜索模板名…"
        title="按模板名称搜索"
      />
      <select className="scriptTemplateSelect" value={templateId} onChange={(e) => setTemplateId(e.target.value)} title="选择已保存模板">
        <option value="">
          选择模板（本地）
          {templateStyleFilter !== "all" || templateQuery.trim() ? " / 已筛选" : ""}
        </option>
        {filteredTemplates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.beats.length}条 · {templateStyleOptions.find((x) => x.value === (t.styleTag ?? "general"))?.label ?? "通用"}
          </option>
        ))}
      </select>
      <button type="button" className="btn" onClick={saveCurrentAsTemplate} title="将当前镜头保存为本地模板">
        保存模板
      </button>
      <button type="button" className="btn" onClick={applyTemplate} disabled={!templateId} title="应用选中模板覆盖当前镜头">
        应用模板
      </button>
      <button type="button" className="btn btnDanger" onClick={deleteTemplate} disabled={!templateId} title="删除选中模板">
        删除模板
      </button>
      <button type="button" className="btn" onClick={exportTemplates} disabled={templatesCount === 0} title="导出全部模板为 JSON">
        导出模板
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => templateImportInputRef.current?.click()}
        title="从 JSON 文件导入模板"
      >
        导入模板
      </button>
      <button
        type="button"
        className="btn"
        onClick={importPresetTemplatePack}
        title="一键导入短剧/电影/动漫/广告/通用预置模板"
      >
        导入预置模板包
      </button>
      <input
        ref={templateImportInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          importTemplatesFromFile(file);
        }}
      />
    </div>
  );
}
