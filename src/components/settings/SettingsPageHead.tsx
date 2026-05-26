import { memo } from "react";

type Props = {
  title: string;
  description?: string;
};

export const SettingsPageHead = memo(function SettingsPageHead({ title, description }: Props) {
  return (
    <header className="settingsPageHead">
      <h2 className="settingsPageTitle">{title}</h2>
      {description ? <p className="settingsPageDesc">{description}</p> : null}
    </header>
  );
});
