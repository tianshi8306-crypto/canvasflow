type IconProps = { size?: number; className?: string };

function base({ size = 18, className }: IconProps) {
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", className, "aria-hidden": true as const };
}

export function IconClose({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlay({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
    </svg>
  );
}

export function IconPause({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <rect x="7" y="5" width="4" height="14" rx="0.5" fill="currentColor" />
      <rect x="13" y="5" width="4" height="14" rx="0.5" fill="currentColor" />
    </svg>
  );
}

export function IconDelete({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path
        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

export function IconChevronLeft({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path d="M14 6L8 12l6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronRight({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconRefresh({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path d="M4 12a8 8 0 018-8c3.2 0 6 1.9 7.3 4.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 12a8 8 0 01-8 8c-3.2 0-6-1.9-7.3-4.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 3h6v6M9 21H3v-6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconZoomIn({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconZoomOut({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconFit({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path
        d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLocate({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMore({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconVideoTrack({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <rect x="3" y="6" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
    </svg>
  );
}

export function IconUndo({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path
        d="M8 7H5.5a2.5 2.5 0 000 5H8M8 7L5 4M8 7l3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconRedo({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path
        d="M16 7h2.5a2.5 2.5 0 010 5H16m0-5l3-3m-3 3l-3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSplit({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrimIn({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path d="M8 6v12M8 6l-4 3M8 6l-4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 6v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

export function IconTrimOut({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path d="M16 6v12M16 6l4 3M16 6l4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 6v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

export function IconSequence({ size, className }: IconProps) {
  return (
    <svg {...base({ size, className })}>
      <path d="M5 6h3v12H5zM11 9h3v9h-3zM17 6h3v12h-3z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function IconExportChevron({ size, className }: IconProps) {
  return (
    <svg {...base({ size: size ?? 14, className })}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
