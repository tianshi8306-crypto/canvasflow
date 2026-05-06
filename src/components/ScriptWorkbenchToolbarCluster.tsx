import type { RefObject } from "react";
import { BATCH_FAV_MAX, CAMERA_MOVE_OPTIONS, CAMERA_MOVE_PRESETS, SHOT_TYPE_OPTIONS, SHOT_TYPE_PRESETS, TEMPLATE_STYLE_OPTIONS } from "@/lib/scriptWorkbenchConstants";
import type { ScriptTemplateItem } from "@/lib/scriptWorkbenchTypes";
import { ScriptWorkbenchBatchMoreMenu } from "@/components/ScriptWorkbenchBatchMoreMenu";
import { ScriptWorkbenchDangerBar } from "@/components/ScriptWorkbenchDangerBar";
import { ScriptWorkbenchTemplateToolbar } from "@/components/ScriptWorkbenchTemplateToolbar";

type BatchField = "shotSize" | "cameraMove";

type Props = {
  templateStyleFilter: string;
  setTemplateStyleFilter: (value: string) => void;
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
  selectAll: () => void;
  invertSelection: () => void;
  clearSelection: () => void;
  rowsLength: number;
  selectedIdsLength: number;
  moreOpen: boolean;
  setMoreOpen: (updater: (v: boolean) => boolean) => void;
  sortByShotNumber: () => void;
  renumberSelectedShotNumbers: () => void;
  padSelectedShotNumbers: () => void;
  batchFillOpen: boolean;
  setBatchFillOpen: (updater: (v: boolean) => boolean) => void;
  batchField: BatchField;
  setBatchField: (value: BatchField) => void;
  batchValue: string;
  setBatchValue: (value: string) => void;
  applyBatchFill: () => void;
  currentFavorites: string[];
  removeBatchFavorite: (fav: string) => void;
  addBatchFavorite: () => void;
  clearBatchField: () => void;
  dangerOpen: boolean;
  setDangerOpen: (updater: (v: boolean) => boolean) => void;
  deleteSelectedRows: () => void;
  keepSelectedOnly: () => void;
  undoLastBatchOperation: () => void;
  hasBatchUndo: boolean;
  batchLogOpen: boolean;
  setBatchLogOpen: (updater: (v: boolean) => boolean) => void;
  recentBatchLogsLength: number;
};

export function ScriptWorkbenchToolbarCluster(props: Props) {
  return (
    <>
      <ScriptWorkbenchTemplateToolbar
        templateStyleFilter={props.templateStyleFilter}
        setTemplateStyleFilter={(value) => {
          props.setTemplateStyleFilter(value);
          props.setTemplateId("");
        }}
        templateStyleOptions={TEMPLATE_STYLE_OPTIONS}
        templateQuery={props.templateQuery}
        setTemplateQuery={props.setTemplateQuery}
        templateId={props.templateId}
        setTemplateId={props.setTemplateId}
        filteredTemplates={props.filteredTemplates}
        templatesCount={props.templatesCount}
        saveCurrentAsTemplate={props.saveCurrentAsTemplate}
        applyTemplate={props.applyTemplate}
        deleteTemplate={props.deleteTemplate}
        exportTemplates={props.exportTemplates}
        importPresetTemplatePack={props.importPresetTemplatePack}
        templateImportInputRef={props.templateImportInputRef}
        importTemplatesFromFile={props.importTemplatesFromFile}
      />
      <div className="scriptToolbarGroup">
        <button type="button" className="btn" onClick={props.selectAll} disabled={props.rowsLength === 0}>
          全选
        </button>
        <button type="button" className="btn" onClick={props.invertSelection} disabled={props.rowsLength === 0}>
          反选
        </button>
        <button type="button" className="btn" onClick={props.clearSelection} disabled={props.selectedIdsLength === 0}>
          清除勾选
        </button>
        <ScriptWorkbenchBatchMoreMenu
          moreOpen={props.moreOpen}
          setMoreOpen={props.setMoreOpen}
          sortByShotNumber={props.sortByShotNumber}
          rowsLength={props.rowsLength}
          renumberSelectedShotNumbers={props.renumberSelectedShotNumbers}
          padSelectedShotNumbers={props.padSelectedShotNumbers}
          selectedIdsLength={props.selectedIdsLength}
          batchFillOpen={props.batchFillOpen}
          setBatchFillOpen={props.setBatchFillOpen}
          batchField={props.batchField}
          setBatchField={props.setBatchField}
          batchValue={props.batchValue}
          setBatchValue={props.setBatchValue}
          applyBatchFill={props.applyBatchFill}
          shotTypeOptions={SHOT_TYPE_OPTIONS}
          cameraMoveOptions={CAMERA_MOVE_OPTIONS}
          shotTypePresets={SHOT_TYPE_PRESETS}
          cameraMovePresets={CAMERA_MOVE_PRESETS}
          currentFavorites={props.currentFavorites}
          batchFavMax={BATCH_FAV_MAX}
          removeBatchFavorite={props.removeBatchFavorite}
          addBatchFavorite={props.addBatchFavorite}
          clearBatchField={props.clearBatchField}
        />
      </div>
      <ScriptWorkbenchDangerBar
        dangerOpen={props.dangerOpen}
        setDangerOpen={props.setDangerOpen}
        deleteSelectedRows={props.deleteSelectedRows}
        keepSelectedOnly={props.keepSelectedOnly}
        undoLastBatchOperation={props.undoLastBatchOperation}
        hasBatchUndo={props.hasBatchUndo}
        selectedIdsLength={props.selectedIdsLength}
        rowsLength={props.rowsLength}
        batchLogOpen={props.batchLogOpen}
        setBatchLogOpen={props.setBatchLogOpen}
        recentBatchLogsLength={props.recentBatchLogsLength}
      />
    </>
  );
}
