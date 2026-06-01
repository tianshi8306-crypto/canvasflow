import { useCallback, useEffect, useState } from "react";
import {
  HERMES_MODEL_HUD_PREFS_UPDATED,
  loadHermesModelHudPrefs,
  patchHermesModelHudPrefs,
  type HermesModelHudPrefs,
} from "@/lib/hermes/hermesModelHudPrefs";

type DetailField = Exclude<keyof HermesModelHudPrefs, "showHud">;

const DETAIL_FIELDS: { key: DetailField; label: string; hint?: string }[] = [
  { key: "showHermesMark", label: "H 标识" },
  { key: "showModel", label: "对话模型", hint: "厂商 · 模型名（设置 → 模型 → 文本）" },
  { key: "showScope", label: "工程与 Tab 归属" },
  { key: "showSessionUsage", label: "本会话 Token 用量" },
  { key: "showQuotaHint", label: "余额 / 配额说明" },
  {
    key: "showBalanceLink",
    label: "「余额」快捷链接",
    hint: "仅当厂商提供控制台地址时显示",
  },
];

export function SettingsHermesModelHudSection() {
  const [prefs, setPrefs] = useState<HermesModelHudPrefs>(() => loadHermesModelHudPrefs());

  const sync = useCallback(() => setPrefs(loadHermesModelHudPrefs()), []);

  useEffect(() => {
    window.addEventListener(HERMES_MODEL_HUD_PREFS_UPDATED, sync);
    return () => window.removeEventListener(HERMES_MODEL_HUD_PREFS_UPDATED, sync);
  }, [sync]);

  const patch = useCallback((p: Partial<HermesModelHudPrefs>) => {
    setPrefs(patchHermesModelHudPrefs(p));
  }, []);

  const detailsDisabled = !prefs.showHud;

  return (
    <div className="settingsSection">
      <div className="settingsSectionTitle">灵体模型状态条</div>
      <p className="settingsFieldHint" style={{ marginBottom: 12 }}>
        画布右上角浮层，展示当前文本模型与用量提示。默认关闭；可按需勾选显示项。
      </p>

      <div className="settingsField">
        <div className="settingsToggle">
          <input
            type="checkbox"
            id="hermesModelHudShow"
            checked={prefs.showHud}
            onChange={(e) => patch({ showHud: e.target.checked })}
          />
          <label htmlFor="hermesModelHudShow" className="settingsToggleLabel">
            <span className="settingsToggleSwitch" />
            <span className="settingsToggleText">显示画布模型状态条</span>
          </label>
        </div>
      </div>

      <fieldset
        className="settingsFieldset"
        disabled={detailsDisabled}
        aria-disabled={detailsDisabled}
      >
        <legend className="settingsFieldLabel">显示内容（可多选）</legend>
        {DETAIL_FIELDS.map(({ key, label, hint }) => (
          <div className="settingsField" key={key}>
            <div className="settingsToggle">
              <input
                type="checkbox"
                id={`hermesModelHud-${key}`}
                checked={prefs[key]}
                onChange={(e) => patch({ [key]: e.target.checked })}
              />
              <label htmlFor={`hermesModelHud-${key}`} className="settingsToggleLabel">
                <span className="settingsToggleSwitch" />
                <span className="settingsToggleText">{label}</span>
              </label>
            </div>
            {hint ? <span className="settingsFieldHint">{hint}</span> : null}
          </div>
        ))}
      </fieldset>
    </div>
  );
}
