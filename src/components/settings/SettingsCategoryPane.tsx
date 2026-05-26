import { memo, type ReactNode } from "react";

import type { SettingsCategory } from "@/components/SettingsNav";

type Props = {
  category: SettingsCategory;
  activeCategory: SettingsCategory;
  visited: ReadonlySet<SettingsCategory>;
  children: ReactNode;
};

/** 已访问过的设置分区保持挂载，仅切换显隐，避免 Tab 切换时反复创建重型 DOM */
export const SettingsCategoryPane = memo(function SettingsCategoryPane({
  category,
  activeCategory,
  visited,
  children,
}: Props) {
  if (!visited.has(category)) return null;
  const isActive = activeCategory === category;
  return (
    <div
      className="settingsCategoryPane"
      hidden={!isActive}
      aria-hidden={!isActive}
    >
      {children}
    </div>
  );
});
