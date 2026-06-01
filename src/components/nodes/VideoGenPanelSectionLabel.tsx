import { VIDEO_PANEL_SECTIONS } from "@/lib/video/videoPanelLibtvSections";

type Props = {
  sectionKey: keyof typeof VIDEO_PANEL_SECTIONS;
  compact: boolean;
  foot?: boolean;
};

export function VideoGenPanelSectionLabel({ sectionKey, compact, foot }: Props) {
  if (compact) return null;
  const s = VIDEO_PANEL_SECTIONS[sectionKey];
  return (
    <span
      className={`mmSectionLabel${foot ? " mmSectionLabel--foot" : ""}${compact ? " mmSectionLabel--compact" : ""}`}
    >
      {compact ? s.compact : s.full}
    </span>
  );
}
