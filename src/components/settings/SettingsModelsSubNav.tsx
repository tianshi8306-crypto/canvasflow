import type { SettingsModelsTabId } from "@/lib/settingsModelsOverview";

const TABS: { id: SettingsModelsTabId; label: string }[] = [
  { id: "overview", label: "总览" },
  { id: "chat", label: "文本与脚本" },
  { id: "image", label: "图片" },
  { id: "video", label: "视频" },
  { id: "audio", label: "语音" },
];

type Props = {
  active: SettingsModelsTabId;
  onSelect: (id: SettingsModelsTabId) => void;
};

export function SettingsModelsSubNav({ active, onSelect }: Props) {
  return (
    <nav className="settingsModelsSubNav" aria-label="模型配置分类">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`settingsModelsSubNavItem${active === tab.id ? " settingsModelsSubNavItem--active" : ""}`}
          onClick={() => onSelect(tab.id)}
          aria-current={active === tab.id ? "page" : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
