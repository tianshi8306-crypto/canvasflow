/** 生成面板共用图标（图片 / 视频） */

export function PanelExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

export function PanelPinIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 17v5M8 11V7a4 4 0 0 1 8 0v4M5 11h14" />
    </svg>
  );
}

export function PanelCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
