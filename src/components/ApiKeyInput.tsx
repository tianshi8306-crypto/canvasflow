/**
 * API Key 输入组件（带显示/隐藏切换）
 * 参考 AI CanvasPro 的密码输入设计
 */
import { useState } from "react";

type Props = {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  id?: string;
};

export function ApiKeyInput({ value, placeholder, onChange, id }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="settingsApiKeyInput">
      <input
        type={visible ? "text" : "password"}
        className="settingsInput mono"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        id={id}
        autoComplete="off"
      />
      <button
        type="button"
        className="settingsApiKeyToggle"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "隐藏密钥" : "显示密钥"}
      >
        {visible ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
      </button>
    </div>
  );
}