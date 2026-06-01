import { memo, useMemo, type ReactNode } from "react";
import {
  IconMenuAudio,
  IconMenuImage,
  IconMenuLlm,
  IconMenuScript,
  IconMenuText,
  IconMenuVideo,
} from "@/components/canvas/canvasMenuNodeIcons";
import { SettingsDreaminaOverviewCard } from "@/components/settings/SettingsDreaminaOverviewCard";
import type { AppSettings } from "@/lib/settingsPanelTypes";
import {
  summarizeModelLanes,
  type SettingsModelsTabId,
} from "@/lib/settingsModelsOverview";

type LaneCard = {
  tab: SettingsModelsTabId;
  title: string;
  nodes: string;
  pickerHint: string;
  icon: ReactNode;
};

const LANES: LaneCard[] = [
  {
    tab: "chat",
    title: "文本与脚本",
    nodes: "文本节点 · 脚本节点 · LLM 节点",
    pickerHint: "节点底栏「默认模型」下拉",
    icon: (
      <span className="settingsModelsOverviewIcons" aria-hidden>
        <IconMenuText size={14} />
        <IconMenuScript size={14} />
        <IconMenuLlm size={14} />
      </span>
    ),
  },
  {
    tab: "image",
    title: "图片生成",
    nodes: "图片节点",
    pickerHint: "图片节点底栏「模型」下拉",
    icon: <IconMenuImage size={18} />,
  },
  {
    tab: "video",
    title: "视频生成",
    nodes: "视频节点",
    pickerHint: "视频节点底栏「模型」下拉",
    icon: <IconMenuVideo size={18} />,
  },
  {
    tab: "audio",
    title: "语音合成",
    nodes: "音频节点",
    pickerHint: "音频节点底栏「模型」下拉",
    icon: <IconMenuAudio size={18} />,
  },
];

type Props = {
  settings: AppSettings;
  onGoToTab: (tab: SettingsModelsTabId) => void;
  keys: Record<string, string>;
  hasKey: Record<string, boolean>;
  onProviderSettingsChange: (patch: Partial<AppSettings>) => void;
  onKeysChange: (providerId: string, field: "apiKey" | "modelApiKey", value: string) => void;
};

export const SettingsModelsOverview = memo(function SettingsModelsOverview({
  settings,
  onGoToTab,
  keys,
  hasKey,
  onProviderSettingsChange,
  onKeysChange,
}: Props) {
  const statusByTab = useMemo(() => {
    const map = new Map<SettingsModelsTabId, { ready: boolean; enabled: number; configured: number }>();
    for (const row of summarizeModelLanes(settings)) {
      if (row.id === "overview") continue;
      map.set(row.id, {
        ready: row.ready,
        enabled: row.enabled,
        configured: row.configured,
      });
    }
    return map;
  }, [settings]);

  return (
    <div className="settingsModelsOverview">
      <p className="settings-desc settings-desc-lead">
        画布上每一类节点使用<strong>不同的模型列表</strong>。先在这里配好，再回到节点底栏选择具体模型。
      </p>
      <div className="settingsModelsOverviewGrid">
        {LANES.map((lane) => {
          const st = statusByTab.get(lane.tab);
          const statusLabel = !st?.configured
            ? "未配置"
            : st.ready
              ? `已就绪 · ${st.enabled} 个启用`
              : `已添加 ${st.configured} 项 · 待填写模型 ID`;
          return (
            <button
              key={lane.tab}
              type="button"
              className="settingsModelsOverviewCard"
              onClick={() => onGoToTab(lane.tab)}
            >
              <div className="settingsModelsOverviewCardIcon">{lane.icon}</div>
              <div className="settingsModelsOverviewCardBody">
                <div className="settingsModelsOverviewCardTitle">{lane.title}</div>
                <div className="settingsModelsOverviewCardNodes">{lane.nodes}</div>
                <div className="settingsModelsOverviewCardHint">{lane.pickerHint}</div>
                <div
                  className={`settingsModelsOverviewCardStatus${
                    st?.ready ? " settingsModelsOverviewCardStatus--ok" : ""
                  }`}
                >
                  {statusLabel}
                </div>
              </div>
              <span className="settingsModelsOverviewCardChevron" aria-hidden>
                →
              </span>
            </button>
          );
        })}
      </div>

      <SettingsDreaminaOverviewCard
        settings={settings}
        keys={keys}
        hasKeyMap={hasKey}
        onSettingsChange={onProviderSettingsChange}
        onKeysChange={onKeysChange}
      />
    </div>
  );
});
