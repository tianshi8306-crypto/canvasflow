type Props = {
  onSave: () => void | Promise<void>;
};

export function SettingsSaveBar({ onSave }: Props) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
      <button type="button" className="btn" onClick={() => void onSave()}>
        保存
      </button>
    </div>
  );
}
