import type { CSSProperties, ReactNode } from "react";

type Props = {
  label: ReactNode;
  children: ReactNode;
  labelStyle?: CSSProperties;
};

export function SettingsFormField({ label, children, labelStyle }: Props) {
  return (
    <div className="field">
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
