import type { ReactNode } from "react";

export type SettingsCategory = "general" | "models" | "shortcuts" | "canvas" | "about";

type Props = {
  activeCategory: SettingsCategory;
  onSelect: (cat: SettingsCategory) => void;
};

type NavItem = {
  id: SettingsCategory;
  label: string;
  icon: ReactNode;
};

function IconGeneral() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconModels() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 20h8M9 16l3 4 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShortcuts() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 10h2M10 10h2M14 10h2M8 14h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconCanvas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconAbout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const navItems: NavItem[] = [
  { id: "general", label: "常规", icon: <IconGeneral /> },
  { id: "models", label: "模型", icon: <IconModels /> },
  { id: "shortcuts", label: "快捷键", icon: <IconShortcuts /> },
  { id: "canvas", label: "画布", icon: <IconCanvas /> },
  { id: "about", label: "关于", icon: <IconAbout /> },
];

export function SettingsNav({ activeCategory, onSelect }: Props) {
  return (
    <nav className="settingsNav">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`settingsNavItem${activeCategory === item.id ? " settingsNavItem--active" : ""}`}
          onClick={() => onSelect(item.id)}
        >
          <span className="settingsNavItemIcon">{item.icon}</span>
          <span className="settingsNavItemLabel">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}