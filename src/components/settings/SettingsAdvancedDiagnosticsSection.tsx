import type { AppSettings } from "@/lib/settingsPanelTypes";
import { SettingsProjectAssetsSection } from "@/components/settings/SettingsProjectAssetsSection";

type Props = {
  settings: AppSettings;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
};

/** 关于页 · 高级诊断：维护向工具，普通用户无需日常访问 */
export function SettingsAdvancedDiagnosticsSection({ settings, onSettingsChange }: Props) {
  return (
    <div className="settingsSection" id="settings-advanced-diagnostics">
      <p className="settingsFieldHint">
        整理素材会移动工程内文件并更新引用，操作前请先保存工程。
      </p>

      <SettingsProjectAssetsSection variant="diagnostics" />

      <div className="settingsField" style={{ marginTop: 16 }}>
        <label className="settingsFieldLabel" htmlFor="settingsFfmpegPathAdvanced">
          FFmpeg 路径（可选）
        </label>
        <span className="settingsFieldHint">
          安装包已内置 FFmpeg，一般留空即可。仅在你需要使用自定义 ffmpeg 可执行文件时填写。
        </span>
        <input
          id="settingsFfmpegPathAdvanced"
          className="settingsInput mono"
          value={settings.ffmpegPath ?? ""}
          onChange={(e) =>
            onSettingsChange({ ffmpegPath: e.target.value.trim() ? e.target.value : null })
          }
          placeholder="留空使用内置"
        />
      </div>
    </div>
  );
}
