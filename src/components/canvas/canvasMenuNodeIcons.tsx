import type { ReactNode } from "react";
import type { AnchorMenuKey } from "@/lib/nodeAnchorMenus";

type IconProps = { size?: number };

/** 画布浮层菜单 / 左侧添加坞 / 节点主面板空态共用图标（图一） */
export function IconMenuText({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconMenuImage({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m8 14 3-3 4 5 3-4 4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconMenuVideo({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9.5v5l4-2.5-4-2.5z" fill="currentColor" />
    </svg>
  );
}

export function IconMenuFfmpeg({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconMenuAudio({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v16M8 8v8M16 8v8M4 10v4M20 10v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMenuScript({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconMenuLlm({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 9.5h8M8 12.5h6M8 15.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconMenuGear({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M19.4 13a7.9 7.9 0 0 0 .1-2l2-1.5-2-3.5-2.3.9a8 8 0 0 0-1.7-1L15 3h-6l-.5 2.9a8 8 0 0 0-1.7 1L4.5 6 2.5 9.5 4.5 11a8 8 0 0 0 0 2l-2 1.5 2 3.5 2.3-.9a8 8 0 0 0 1.7 1L9 21h6l.5-2.9a8 8 0 0 0 1.7-1l2.3.9 2-3.5-2-1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMenuLayers({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4 4 8l8 4 8-4-8-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="m4 12 8 4 8-4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="m4 16 8 4 8-4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

const MENU_ICON_BY_KEY: Partial<Record<AnchorMenuKey, (props: IconProps) => ReactNode>> = {
  textNode: IconMenuText,
  imageNode: IconMenuImage,
  videoNode: IconMenuVideo,
  ffmpegConcat: IconMenuFfmpeg,
  audioNode: IconMenuAudio,
  scriptNode: IconMenuScript,
  llm: IconMenuLlm,
  videoFirstLastSetup: IconMenuGear,
  videoFirstFrameSetup: IconMenuGear,
  audioTts: IconMenuGear,
  imageI2iImport: IconMenuLayers,
};

/** 锚点 / 右键菜单行内图标（外包统一格样式 className） */
export function canvasMenuNodeIconForKey(key: AnchorMenuKey, size = 16): ReactNode {
  const Icon = MENU_ICON_BY_KEY[key];
  return Icon ? <Icon size={size} /> : null;
}

export function CanvasMenuNodeIconCell({ children }: { children: ReactNode }) {
  return (
    <span className="canvasPaneCtxMenu__icon" aria-hidden>
      {children}
    </span>
  );
}

export function renderCanvasMenuNodeIcon(key: AnchorMenuKey): ReactNode {
  return <CanvasMenuNodeIconCell>{canvasMenuNodeIconForKey(key)}</CanvasMenuNodeIconCell>;
}
