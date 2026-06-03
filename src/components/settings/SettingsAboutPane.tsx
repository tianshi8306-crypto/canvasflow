import { useCallback, useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { AppUpdateDialog } from "@/components/AppUpdateDialog";
import { SettingsAdvancedDiagnosticsSection } from "@/components/settings/SettingsAdvancedDiagnosticsSection";
import { SettingsPageHead } from "@/components/settings/SettingsPageHead";
import { checkForAppUpdateManual, type PendingAppUpdate } from "@/lib/appUpdater";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import type { AppSettings } from "@/lib/settingsPanelTypes";

type Props = {
  settings: AppSettings;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onOpenShortcuts?: () => void;
};

export function SettingsAboutPane({ settings, onSettingsChange, onOpenShortcuts }: Props) {
  const [appVersion, setAppVersion] = useState<string>("…");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingAppUpdate | null>(null);

  useEffect(() => {
    if (isTauri()) {
      void getVersion().then(setAppVersion).catch(() => setAppVersion("未知"));
    } else {
      setAppVersion(import.meta.env.VITE_APP_VERSION ?? "浏览器预览");
    }
  }, []);

  const onCheckUpdate = useCallback(() => {
    if (!isTauri()) {
      setUpdateNote(DESKTOP_SHELL_HINT);
      return;
    }
    setUpdateBusy(true);
    setUpdateNote(null);
    void checkForAppUpdateManual()
      .then((pending) => {
        if (pending) {
          setPendingUpdate(pending);
          setUpdateNote(null);
          return;
        }
        setUpdateNote("当前已是最新版本。");
      })
      .catch((err) => {
        setUpdateNote(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setUpdateBusy(false));
  }, []);

  const exportDiagnostics = () => {
    void (async () => {
      const version = isTauri() ? await getVersion().catch(() => appVersion) : appVersion;
      const info = {
        product: "CanvasFlow AI Studio",
        version,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      };
      const blob = new Blob([JSON.stringify(info, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `canvasflow-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    })();
  };

  return (
    <>
      <SettingsPageHead title="关于" description="版本、更新与问题排查。" />

      <div className="settingsSection">
        <div className="settingsAbout">
          <div className="settingsAboutLogo">CanvasFlow AI Studio</div>
          <div className="settingsAboutVersion">版本 {appVersion}</div>
          <div className="settingsAboutDesc">面向视频创作流程的节点化 AI 工作台</div>
        </div>

        <div className="settingsField" style={{ marginTop: 16 }}>
          <div className="settingsAboutActions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={updateBusy}
              onClick={onCheckUpdate}
            >
              {updateBusy ? "检查中…" : "检查更新"}
            </button>
            {onOpenShortcuts ? (
              <button type="button" className="btn btn--secondary" onClick={onOpenShortcuts}>
                快捷键说明
              </button>
            ) : null}
            <button type="button" className="btn btn--secondary" onClick={exportDiagnostics}>
              导出诊断信息
            </button>
          </div>
          {updateNote ? <p className="settingsFieldHint">{updateNote}</p> : null}
        </div>
      </div>

      <details className="settingsAdvancedBlock">
        <summary className="settingsAdvancedBlockSummary">高级诊断</summary>
        <SettingsAdvancedDiagnosticsSection
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </details>

      {pendingUpdate ? (
        <AppUpdateDialog pending={pendingUpdate} onClose={() => setPendingUpdate(null)} />
      ) : null}
    </>
  );
}
