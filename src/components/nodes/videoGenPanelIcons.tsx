export function VideoGenPanelIconDropdown() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function VideoGenPanelIconSpeaker({ off }: { off?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      {off ? (
        <>
          <path d="M23 9l-6 6" />
          <path d="M17 9l6 6" />
        </>
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 010 7.07" />
          <path d="M19.07 4.93a10 10 0 010 14.14" />
        </>
      )}
    </svg>
  );
}
