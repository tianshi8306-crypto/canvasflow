export function ColsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 4h3v16H5V4zm5.5 0h3v16h-3V4zm5.5 0h3v16h-3V4z" fill="currentColor" />
    </svg>
  );
}

export function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h16l-6 7v5l-4 2v-7L4 5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 5c-5 0-9 4-9 7s4 7 9 7 9-4 9-7-4-7-9-7z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4l16 16M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-5.1M6.6 6.6C4.6 7.9 3 10 3 12c0 3 4 7 9 7 1.8 0 3.5-.5 5-1.3M10.6 4.5A9 9 0 0 1 12 4c5 0 9 4 9 7 0 1.2-.6 2.5-1.6 3.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
