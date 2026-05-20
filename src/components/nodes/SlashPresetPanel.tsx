import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { CATEGORIES, type Category } from "@/lib/slashPresets";
import { useSlashPresets } from "@/hooks/useSlashPresets";
import { USER_INPUT_PLACEHOLDER } from "@/lib/slashPresets";
import "./SlashPresetPanel.css";

/** 与模型/比例/风格浮层同层，避免被生成面板裁切 */
export const SLASH_PRESET_PANEL_Z = 1200;

const PANEL_WIDTH = 460;
const MENU_SELECTOR = ".slash-preset-panel--portal";

/** 分类图标 SVG（白色线性） */
function CategoryIcon({ category }: { category: Category }) {
  const icons: Record<Category, JSX.Element> = {
    "人物参考": (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4"/>
        <path d="M5.5 21v-2a5.5 5.5 0 0 1 11 0v2"/>
      </svg>
    ),
    "场景构图": (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 3v18"/>
      </svg>
    ),
    "脚本结构": (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="14" rx="2"/>
        <path d="M7 22v-4M12 22v-4M17 22v-4"/>
        <path d="M7 8h10M7 12h6"/>
      </svg>
    ),
    "信息提取": (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
    ),
    "多宫格": (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    "通用": (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  };
  return icons[category] ?? null;
}

/** 预设图标 SVG */
function PresetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
  );
}

interface SlashPresetPanelProps {
  cursorRect: DOMRect;
  onSelect: (presetId: string) => void;
  onClose: () => void;
}

export function SlashPresetPanel({ cursorRect, onSelect, onClose }: SlashPresetPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { presets, recordUsage } = useSlashPresets();

  const position = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_WIDTH, vw - 24);
    const left = Math.min(
      cursorRect.left + cursorRect.width / 2 - width / 2,
      vw - width - 12,
    );
    const gap = 10;
    const belowTop = cursorRect.bottom + gap;
    const panelMaxH = Math.min(360, vh - 24);
    const spaceBelow = vh - belowTop - 12;
    const openAbove = spaceBelow < 200 && cursorRect.top > panelMaxH + gap + 12;
    return {
      left: Math.max(12, left),
      top: openAbove ? cursorRect.top - gap : belowTop,
      transform: openAbove ? "translateY(-100%)" : undefined,
      maxHeight: openAbove
        ? Math.min(panelMaxH, cursorRect.top - gap - 12)
        : Math.min(panelMaxH, spaceBelow),
    };
  }, [cursorRect]);

  const filtered = useMemo(() => {
    if (!search.trim()) return presets;
    const q = search.toLowerCase();
    return presets.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.template.toLowerCase().includes(q)
    );
  }, [presets, search]);

  const grouped = useMemo(() => {
    const acc: Record<string, typeof filtered> = {};
    for (const p of filtered) {
      (acc[p.category] ??= []).push(p);
    }
    return acc;
  }, [filtered]);

  const currentItems = useMemo(() => {
    if (search.trim()) return filtered;
    return grouped[activeCategory] ?? [];
  }, [search, activeCategory, grouped, filtered]);

  useEffect(() => { setSelectedIndex(0); }, [search, activeCategory]);
  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      const menu = document.querySelector(MENU_SELECTOR);
      if (menu?.contains(target)) return;
      onClose();
    };
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  const handleSelect = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;
      recordUsage(presetId);
      onSelect(presetId);
    },
    [presets, recordUsage, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, currentItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (currentItems[selectedIndex]) {
          handleSelect(currentItems[selectedIndex].id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [currentItems, selectedIndex, handleSelect, onClose]
  );

  const panel = (
    <div
      ref={panelRef}
      className="slash-preset-panel slash-preset-panel--portal imageGenPanel--minimal"
      style={{
        left: position.left,
        top: position.top,
        transform: position.transform,
        maxHeight: position.maxHeight,
        zIndex: SLASH_PRESET_PANEL_Z,
      }}
      role="dialog"
      aria-label="指令预设"
      onKeyDown={handleKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 搜索栏 */}
      <div className="slash-preset-search">
        <input
          ref={searchRef}
          className="slash-preset-search-input"
          placeholder="搜索预设..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "/" || e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
      </div>

      {/* 主体：L1 分类侧边栏 + L2 预设列表 */}
      <div className="slash-preset-body">
        {/* L1 分类列（搜索时隐藏） */}
        {!search.trim() && (
          <div className="slash-preset-categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`slash-preset-cat-btn${activeCategory === cat ? " active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                <span className="slash-preset-cat-icon">
                  <CategoryIcon category={cat} />
                </span>
                <span className="slash-preset-cat-label">{cat}</span>
                <span className="slash-preset-cat-arrow">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* L2 预设列表 */}
        <div className="slash-preset-list">
          {currentItems.length === 0 ? (
            <div className="slash-preset-empty">无匹配结果</div>
          ) : (
            Object.entries(
              search.trim()
                ? { "搜索结果": currentItems }
                : { [activeCategory]: currentItems }
            ).map(([category, items]) => (
              <div key={category} className="slash-preset-group">
                {!search.trim() && (
                  <div className="slash-preset-group-label">{category}</div>
                )}
                {items.map((preset) => {
                  const flatIdx = currentItems.indexOf(preset);
                  return (
                    <div
                      key={preset.id}
                      className={`slash-preset-item${flatIdx === selectedIndex ? " selected" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(preset.id); }}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                    >
                      <span className="slash-preset-icon">
                        <PresetIcon />
                      </span>
                      <div className="slash-preset-item-content">
                        <div className="slash-preset-title">{preset.title}</div>
                        <div
                          className="slash-preset-template"
                          dangerouslySetInnerHTML={{
                            __html: preset.template.replace(
                              USER_INPUT_PLACEHOLDER,
                              '<span class="preset-input-hint">[输入]</span>'
                            ),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}