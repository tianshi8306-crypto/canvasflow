/** 文本预览工具条图标（节点顶栏 / 全屏展开共用） */

export function IconCopyBody() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
      <path
        fill="currentColor"
        d="M5.5 2.5h6a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 4 10V4a1.5 1.5 0 0 1 1.5-1.5Zm1 2v5h4V5h-4ZM3 6.5v6a1.5 1.5 0 0 0 1.5 1.5h6v-1H4.5a.5.5 0 0 1-.5-.5v-6H3Z"
      />
    </svg>
  );
}

export function IconExpandPreview() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        d="M4 6V4h2M10 4h2v2M12 10v2h-2M6 12H4v-2M4 4l2.5 2.5M12 4 9.5 6.5M12 12 9.5 9.5M4 12 6.5 9.5"
      />
    </svg>
  );
}

export function IconUnorderedList() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="7" r="1.5" fill="currentColor" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="6" cy="17" r="1.5" fill="currentColor" />
      <path d="M10 7h10M10 12h10M10 17h7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconOrderedList() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <text x="3" y="9" fill="currentColor" fontSize="6" fontWeight="700" fontFamily="inherit">
        1
      </text>
      <text x="3" y="17" fill="currentColor" fontSize="6" fontWeight="700" fontFamily="inherit">
        2
      </text>
      <path d="M12 7h9M12 12h9M12 17h7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconHorizontalRule() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function FmtHeadingLabel({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="textNodeFmtHeadingLabel" aria-hidden>
      H<sub>{level}</sub>
    </span>
  );
}
