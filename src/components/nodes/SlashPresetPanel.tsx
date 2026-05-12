import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useSlashPresets } from "@/hooks/useSlashPresets";
import { USER_INPUT_PLACEHOLDER } from "@/lib/slashPresets";
import "./SlashPresetPanel.css";

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 360;

interface SlashPresetPanelProps {
  cursorRect: DOMRect;
  onSelect: (template: string) => void;
  onClose: () => void;
}

export function SlashPresetPanel({ cursorRect, onSelect, onClose }: SlashPresetPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { presets, recordUsage } = useSlashPresets();

  const position = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - cursorRect.bottom;
    const left = Math.min(cursorRect.left, vw - PANEL_WIDTH - 8);
    const vertical: "bottom" | "top" =
      spaceBelow >= PANEL_MAX_HEIGHT + 8 ? "bottom" : "top";
    return {
      left,
      vertical,
      top: vertical === "bottom" ? cursorRect.bottom : undefined,
      bottom: vertical === "top" ? vh - cursorRect.top : undefined,
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

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSelect = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;
      recordUsage(presetId);
      onSelect(preset.template);
    },
    [presets, recordUsage, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex].id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, handleSelect, onClose]
  );

  const grouped = useMemo(() => {
    const acc: Record<string, typeof filtered> = {};
    for (const p of filtered) {
      (acc[p.category] ??= []).push(p);
    }
    return acc;
  }, [filtered]);

  const flat = filtered;

  return (
    <div
      ref={panelRef}
      className="slash-preset-panel"
      style={{ left: position.left, top: position.top, bottom: position.bottom }}
      onKeyDown={handleKeyDown}
    >
      <div className="slash-preset-search">
        <input
          ref={searchRef}
          className="slash-preset-search-input"
          placeholder="搜索预设..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === "/" || e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
      </div>
      <div className="slash-preset-list">
        {filtered.length === 0 ? (
          <div className="slash-preset-empty">
            无匹配结果，可创建自定义预设
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="slash-preset-group">
              <div className="slash-preset-group-label">{category}</div>
              {items.map((preset) => {
                const flatIdx = flat.indexOf(preset);
                return (
                  <div
                    key={preset.id}
                    className={`slash-preset-item ${flatIdx === selectedIndex ? "selected" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(preset.id); }}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                  >
                    <span className="slash-preset-icon">{preset.icon}</span>
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
  );
}
