import { useState, type Dispatch, type SetStateAction } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import { formatUserError } from "@/lib/errors";
import { newVideoModelTemplate } from "@/lib/settingsModelTemplates";
import {
  DOUBAO_SEEDANCE_API_BASE,
  DOUBAO_SEEDANCE_API_MODEL,
} from "@/lib/videoGeneration/seedanceApiModel";
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
  const [testingModelId, setTestingModelId] = useState<string | null>(null);

  return (
    <div className="settingsSection">
      <SettingsSectionHeader
        title="视频生成模型"
        description="仅用于画布「视频」节点底栏的模型下拉（文生视频、图生视频等）。"
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
      <div className="settingsModelsNodeBadges">
        <span className="settingsModelsNodeBadge">视频节点</span>
      </div>

      {videoModels.length === 0 ? (
        <p className="settings-desc">尚未配置视频模型；添加后可在视频节点底栏选择。</p>
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
              placeholder={`例如：${DOUBAO_SEEDANCE_API_MODEL}`}
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
              placeholder={DOUBAO_SEEDANCE_API_BASE}
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
          {isTauri() ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                disabled={testingModelId === m.id}
                onClick={async () => {
                  try {
                    setTestingModelId(m.id);
                    const msg = await invoke<string>("test_video_model_connection", {
                      videoModelId: m.id,
                      apiKeyOverride: videoModelKeys[m.id]?.trim() || null,
                    });
                    alert(msg);
                  } catch (e) {
                    alert(formatUserError(e));
                  } finally {
                    setTestingModelId(null);
                  }
                }}
              >
                {testingModelId === m.id ? "测试中…" : "测试连接"}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
