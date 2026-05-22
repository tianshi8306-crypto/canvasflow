import { memo, type ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export const SettingsSectionHeader = memo(function SettingsSectionHeader({
  title,
  description,
  action,
}: Props) {
  return (
    <div className="settingsSectionHeader">
      <div className="settingsSectionHeaderText">
        <h3 className="settingsSectionHeaderTitle">{title}</h3>
        {description ? <p className="settings-desc settings-desc-tight">{description}</p> : null}
      </div>
      {action ? <div className="settingsSectionHeaderAction">{action}</div> : null}
    </div>
  );
});
