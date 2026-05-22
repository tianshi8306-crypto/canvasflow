import type { Dispatch, SetStateAction } from "react";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import { newVideoModelTemplate } from "@/lib/settingsModelTemplates";
import { SettingsFormField } from "@/components/SettingsFormField";
import { SettingsSectionHeader } from "@/components/settings/SettingsSectionHeader";

type Props = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  videoModelKeys: Record<string, string>;
  setVideoModelKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasVideoModelKey: Record<string, boolean>;
};

export function SettingsVideoModelsSection({
  settings,
  setSettings,
  videoModelKeys,
  setVideoModelKeys,
  hasVideoModelKey,
}: Props) {
  const videoModels = settings.videoModels ?? [];

  return (
    <div className="settingsSection settingsSection--sub">
      <SettingsSectionHeader
        title="视频模型"
        description="供视频节点用于文生视频、图生视频等 API 对接。"
        action={
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() =>
              setSettings((prev) =>
                prev ? { ...prev, videoModels: [...(prev.videoModels ?? []), newVideoModelTemplate()] } : prev,
              )
            }
          >
            添加模型
          </button>
        }
      />
      {videoModels.length === 0 ? (
        <p className="settings-desc">尚未配置视频模型；添加后可在视频节点中选择。</p>
      ) : null}
      {videoModels.map((m) => (
        <div key={m.id} className="settingsModelCard">
          <div className="settingsModelCardHead">
            <div className="settingsModelCardTitle">{m.label?.trim() || m.model || "视频模型"}</div>
            <div className="settingsModelCardFlags">
              <label className="settingsModelCardFlag">
                <input
                  type="checkbox"
                  checked={m.enabled}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            videoModels: (prev.videoModels ?? []).map((x) =>
                              x.id === m.id ? { ...x, enabled: e.target.checked } : x,
                            ),
                          }
                        : prev,
                    )
                  }
                />
                启用
              </label>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          videoModels: (prev.videoModels ?? []).filter((x) => x.id !== m.id),
                        }
                      : prev,
                  )
                }
              >
                删除
              </button>
            </div>
          </div>
          <div style={{ height: 10 }} />
          <SettingsFormField label="显示名称（可选）">
            <input
              className="mono"
              value={m.label}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        videoModels: (prev.videoModels ?? []).map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)),
                      }
                    : prev,
                )
              }
              placeholder="例如：火山视频"
            />
          </SettingsFormField>
          <SettingsFormField label="模型标识">
            <input
              className="mono"
              value={m.model}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        videoModels: (prev.videoModels ?? []).map((x) => (x.id === m.id ? { ...x, model: e.target.value } : x)),
                      }
                    : prev,
                )
              }
              placeholder="例如：doubao_seedance_2_0"
            />
          </SettingsFormField>
          <SettingsFormField label="API Base URL">
            <input
              className="mono"
              value={m.apiBaseUrl}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        videoModels: (prev.videoModels ?? []).map((x) => (x.id === m.id ? { ...x, apiBaseUrl: e.target.value } : x)),
                      }
                    : prev,
                )
              }
              placeholder="https://xxx/v1"
            />
          </SettingsFormField>
          <SettingsFormField label="API Key（视频节点；不会回显，保存后写入系统凭据）">
            <input
              className="mono"
              value={videoModelKeys[m.id] ?? ""}
              placeholder={hasVideoModelKey[m.id] ? "已保存（输入新值可覆盖）" : "请输入 API Key"}
              onChange={(e) => setVideoModelKeys((prev) => ({ ...prev, [m.id]: e.target.value }))}
            />
          </SettingsFormField>
        </div>
      ))}
    </div>
  );
}
