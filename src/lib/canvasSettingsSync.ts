import { applyAppTheme } from "@/lib/appTheme";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import { useCanvasUiStore } from "@/store/canvasUiStore";

/** 将持久化设置同步到画布 UI store（启动与保存后调用） */
export function applyAppSettingsToCanvasUi(settings: AppSettings): void {
  const ui = useCanvasUiStore.getState();
  applyAppTheme(settings.themePreset);
  ui.setThemePreset(settings.themePreset);
  ui.setSnapGuidesEnabled(settings.snapGuidesEnabled !== false);
  ui.setSnapGridEnabled(settings.snapGridEnabled === true);
  ui.setAlignDistributeGap(settings.alignDistributeGap ?? 40);
  ui.setGridDotsVisible(settings.gridDotsVisible !== false);
  ui.setConnectionLinesVisible(settings.connectionLinesVisible !== false);
}
