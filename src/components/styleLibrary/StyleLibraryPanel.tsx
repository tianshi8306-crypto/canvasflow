import { useEffect, useMemo, useState, useRef } from "react";
import type { StyleCategory, StylePreset } from "@/lib/styleLibrary/types";
import { STYLE_CATEGORY_META, isStyleCategory } from "@/lib/styleLibrary/types";
import { fetchStyleLibrary } from "@/lib/styleLibrary/loader";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";
import "./StyleLibraryPanel.css";

export default function StyleLibraryPanel() {
  const open = useCanvasUiStore((s) => s.styleLibraryPanelOpen);
  const toggle = useCanvasUiStore((s) => s.toggleStyleLibraryPanel);
  const activeStyleId = useProjectStore((s) => s.activeStyleId);
  const setActiveStyleId = useProjectStore((s) => s.setActiveStyleId);
  const [cat, setCat] = useState<StyleCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<StylePreset[] | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchStyleLibrary().then(setLibrary).catch(() => setLibrary([]));
  }, []);

  // 清除播放定时器
  useEffect(() => {
    return () => { if (playingTimer.current) clearTimeout(playingTimer.current); };
  }, []);

  const categories = useMemo(() => {
    if (!library) return [];
    const cats = new Set(library.map((s) => s.category));
    return Array.from(cats).filter(isStyleCategory);
  }, [library]);

  const filtered = useMemo(() => {
    if (!library) return [];
    let list = cat === "all" ? library : library.filter((s) => s.category === cat);
    const q = query.toLowerCase().trim();
    if (q) {
      list = list.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        s.hints.some((h) => h.toLowerCase().includes(q)));
    }
    return list;
  }, [library, cat, query]);

  const activeStyle = activeStyleId && library
    ? library.find((s) => s.id === activeStyleId)
    : null;

  const handleCardEnter = (id: string) => {
    if (playingTimer.current) clearTimeout(playingTimer.current);
    playingTimer.current = setTimeout(() => setPlayingId(id), 400);
  };
  const handleCardLeave = (id: string) => {
    if (playingTimer.current) clearTimeout(playingTimer.current);
    if (playingId === id) setPlayingId(null);
  };

  return (
    <>
      {open && <div className="styleLibBackdrop" onClick={toggle} />}
      <aside className={`styleLibPanel${open ? " styleLibPanel--open" : ""}`}>
        <div className="styleLibPanelInner">
          <div className="styleLibHeader">
            <h2 className="styleLibTitle">风格库</h2>
            <button className="styleLibClose" onClick={toggle} aria-label="关闭风格库">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {library == null ? (
            <div className="styleLibEmpty">加载风格库中…</div>
          ) : library.length === 0 ? (
            <div className="styleLibEmpty">风格库不可用</div>
          ) : (
            <>
              <div className="styleLibSearch">
                <svg className="styleLibSearchIcon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input className="styleLibSearchInput" type="text" placeholder="搜索风格关键词…"
                  value={query} onChange={(e) => setQuery(e.target.value)}/>
              </div>
              <div className="styleLibCats">
                <button className={`styleLibCat${cat === "all" ? " styleLibCat--active" : ""}`}
                  onClick={() => setCat("all")}>全部</button>
                {categories.map((c) => (
                  <button key={c} className={`styleLibCat${cat === c ? " styleLibCat--active" : ""}`}
                    onClick={() => setCat(c)}
                    style={{ "--cat-color": STYLE_CATEGORY_META[c].color } as React.CSSProperties}>
                    {STYLE_CATEGORY_META[c].label}
                  </button>
                ))}
              </div>
              {activeStyle && (
                <div className="styleLibActiveHint">
                  当前：<strong>{activeStyle.title}</strong>
                  <button className="styleLibClearBtn" onClick={() => setActiveStyleId(null)}>清除</button>
                </div>
              )}
              <div className="styleLibList">
                {filtered.map((style) => {
                  const isActive = activeStyleId === style.id;
                  const isPlaying = playingId === style.id && style.hasVideo && style.videoUrl;
                  return (
                    <button key={style.id}
                      className={`styleLibCard${isActive ? " styleLibCard--active" : ""}`}
                      onClick={() => setActiveStyleId(activeStyleId === style.id ? null : style.id)}
                      onMouseEnter={style.hasVideo ? () => handleCardEnter(style.id) : undefined}
                      onMouseLeave={style.hasVideo ? () => handleCardLeave(style.id) : undefined}>
                      <div className={`styleLibCardThumb${style.hasVideo && style.videoUrl ? " styleLibCardThumb--video" : ""}`}>
                        {style.hasVideo && style.videoUrl ? (
                          <>
                            <img
                              className="styleLibCardPoster"
                              src={style.thumbnailUrl!}
                              alt={style.title}
                              loading="lazy"
                              style={{ opacity: isPlaying ? 0 : 1 }}
                            />
                            {isPlaying && (
                              <video
                                className="styleLibCardVideo"
                                src={style.videoUrl}
                                muted
                                loop
                                autoPlay
                                playsInline
                              />
                            )}
                            <span className="styleLibCardPlayIcon">
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="9" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.45)" strokeWidth="1"/>
                                <path d="M8 6.5v7l5.5-3.5L8 6.5z" fill="#fff"/>
                              </svg>
                            </span>
                          </>
                        ) : (
                          <div className="styleLibCardThumbInner" style={{
                            background: `linear-gradient(135deg, var(--card-bg, #1e1e24) 0%, ${STYLE_CATEGORY_META[style.category].color}22 100%)`,
                            borderColor: `${STYLE_CATEGORY_META[style.category].color}44`,
                          }}>
                            <span className="styleLibCardCat"
                              style={{ background: `${STYLE_CATEGORY_META[style.category].color}33`, color: STYLE_CATEGORY_META[style.category].color }}>
                              {STYLE_CATEGORY_META[style.category].label}
                            </span>
                            <span className="styleLibCardTitle">{style.title}</span>
                            {style.tags.length > 0 && (
                              <div className="styleLibCardThumbTags">
                                {style.tags.slice(0, 2).map((t) => (
                                  <span key={t} className="styleLibCardThumbTag">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="styleLibCardBody">
                        <p className="styleLibCardHint">{style.hints[0] ?? style.visualStyle.slice(0, 60)}</p>
                        <div className="styleLibCardTags">
                          {style.tags.slice(0, 4).map((t) => (<span key={t} className="styleLibCardTag">{t}</span>))}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && <p className="styleLibEmpty">没有匹配的风格</p>}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
