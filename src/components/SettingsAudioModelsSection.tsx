import type { Dispatch, SetStateAction } from "react";
import type { AppSettings, ImageModelConfig } from "@/lib/settingsPanelTypes";
import { newAudioModelTemplate } from "@/lib/settingsModelTemplates";
import { SettingsFormField } from "@/components/SettingsFormField";
import { SettingsSectionHeader } from "@/components/settings/SettingsSectionHeader";

type Props = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  audioModelKeys: Record<string, string>;
  setAudioModelKeys: Dispatch<SetStateAction<Record<string, string>>>;
  hasAudioModelKey: Record<string, boolean>;
};

export function SettingsAudioModelsSection({
  settings,
  setSettings,
  audioModelKeys,
  setAudioModelKeys,
  hasAudioModelKey,
}: Props) {
  const audioModels = settings.audioModels ?? [];

  return (
    <div className="settingsSection">
      <SettingsSectionHeader
        title="语音合成模型"
        description="用于画布「音频」节点。需 OpenAI 兼容 TTS（POST …/v1/audio/speech）。若已在「文本与脚本」启用 OpenAI，也可共用其密钥。"
        action={
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() =>
              setSettings((prev) =>
                prev ? { ...prev, audioModels: [...(prev.audioModels ?? []), newAudioModelTemplate()] } : prev,
              )
            }
          >
            添加模型
          </button>
        }
      />

      <div className="settingsModelsNodeBadges">
        <span className="settingsModelsNodeBadge">音频节点</span>
      </div>

      {audioModels.length === 0 ? (
        <p className="settings-desc">尚未配置语音模型；未配置时可尝试使用文本与脚本中的 OpenAI 服务商。</p>
      ) : null}

      {audioModels.map((m) => (
        <div key={m.id} className="settingsModelCard">
          <div className="settingsModelCardHead">
            <div className="settingsModelCardTitle">{m.label?.trim() || m.model || "TTS 模型"}</div>
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
                            audioModels: (prev.audioModels ?? []).map((x) =>
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
                          audioModels: (prev.audioModels ?? []).filter((x) => x.id !== m.id),
                        }
                      : prev,
                  )
                }
              >
                删除
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSettings((prev) => {
                    if (!prev) return prev;
                    const clone: ImageModelConfig = {
                      ...m,
                      id: `audio-model-${Date.now()}`,
                      enabled: false,
                    };
                    return { ...prev, audioModels: [...(prev.audioModels ?? []), clone] };
                  })
                }
              >
                复制
              </button>
            </div>
          </div>

          <SettingsFormField label="显示名称（可选）">
            <input
              className="mono"
              value={m.label}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        audioModels: (prev.audioModels ?? []).map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)),
                      }
                    : prev,
                )
              }
              placeholder="例如：自建 TTS"
            />
          </SettingsFormField>

          <SettingsFormField label="模型标识（speech API 的 model 字段）">
            <input
              className="mono"
              value={m.model}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        audioModels: (prev.audioModels ?? []).map((x) => (x.id === m.id ? { ...x, model: e.target.value } : x)),
                      }
                    : prev,
                )
              }
              placeholder="tts-1 或 tts-1-hd 等"
            />
          </SettingsFormField>

          <SettingsFormField label="API Base URL（须含 /v1）">
            <input
              className="mono"
              value={m.apiBaseUrl}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        audioModels: (prev.audioModels ?? []).map((x) =>
                          x.id === m.id ? { ...x, apiBaseUrl: e.target.value } : x,
                        ),
                      }
                    : prev,
                )
              }
              placeholder="https://api.openai.com/v1"
            />
          </SettingsFormField>

          <SettingsFormField label="API Key（音频节点；不会回显，保存后写入系统凭据）">
            <input
              className="mono"
              value={audioModelKeys[m.id] ?? ""}
              placeholder={hasAudioModelKey[m.id] ? "已保存（输入新值可覆盖）" : "请输入 API Key"}
              onChange={(e) => setAudioModelKeys((prev) => ({ ...prev, [m.id]: e.target.value }))}
            />
          </SettingsFormField>

          <SettingsFormField label="优先级（数字越小越靠前）">
            <input
              type="number"
              value={m.priority}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        audioModels: (prev.audioModels ?? []).map((x) =>
                          x.id === m.id ? { ...x, priority: Number.isFinite(v) ? v : 0 } : x,
                        ),
                      }
                    : prev,
                );
              }}
            />
          </SettingsFormField>
        </div>
      ))}
    </div>
  );
}
