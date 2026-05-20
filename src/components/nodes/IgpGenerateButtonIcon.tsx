type Props = { generating?: boolean };

/** 生成面板底栏：生成 / 取消 图标 */
export function IgpGenerateButtonIcon({ generating = false }: Props) {
  if (generating) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v12M8 11l4-4 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
