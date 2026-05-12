import { useState, useMemo, useCallback } from "react";
import { useSlashPresets } from "@/hooks/useSlashPresets";
import { CATEGORIES, type Category } from "@/lib/slashPresets";
import "./LeftPresetDock.css";

const ALL_TABS = ["全部", ...CATEGORIES] as const;

export function LeftPresetDock() {
  const { presets, addCustomPreset, removeCustomPreset } = useSlashPresets();
  const [activeTab, setActiveTab] = useState<typeof ALL_TABS[number]>("全部");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    desc: "",
    icon: "✏️",
    template: "",
    category: "通用" as Category,
  });

  const filtered = useMemo(() => {
    let list = presets;
    if (activeTab !== "全部") {
      list = list.filter((p) => p.category === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.desc.toLowerCase().includes(q)
      );
    }
    return list;
  }, [presets, activeTab, search]);

  const handleSubmit = useCallback(() => {
    if (!form.title.trim() || !form.template.trim()) return;
    addCustomPreset(form);
    setForm({ title: "", desc: "", icon: "✏️", template: "", category: "通用" });
    setShowForm(false);
  }, [form, addCustomPreset]);

  return (
    <div className="left-preset-dock">
      <div className="left-preset-dock-header">预设管理</div>
      <div className="left-preset-tabs">
        {ALL_TABS.map((tab) => (
          <button
            key={tab}
            className={`left-preset-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="left-preset-search">
        <input
          placeholder="搜索预设..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="left-preset-list">
        {filtered.map((preset) => (
          <div key={preset.id} className="left-preset-item">
            <span className="left-preset-icon">{preset.icon}</span>
            <div className="left-preset-item-content">
              <div className="left-preset-title">{preset.title}</div>
              <div className="left-preset-desc">{preset.desc}</div>
            </div>
            {preset.isCustom ? (
              <button
                className="left-preset-delete"
                onClick={() => removeCustomPreset(preset.id)}
                title="删除"
              >
                🗑️
              </button>
            ) : (
              <span className="left-preset-builtin" title="内置预设">📦</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="left-preset-empty">暂无预设</div>
        )}
      </div>
      <div className="left-preset-footer">
        {showForm ? (
          <div className="left-preset-form">
            <input
              placeholder="名称"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as Category })
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              placeholder="描述"
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
            />
            <textarea
              placeholder="模板内容（使用 __SLASH_INPUT__ 表示输入位）"
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value })}
            />
            <div className="left-preset-form-actions">
              <button onClick={() => setShowForm(false)}>取消</button>
              <button className="primary" onClick={handleSubmit}>
                保存预设
              </button>
            </div>
          </div>
        ) : (
          <button className="left-preset-add" onClick={() => setShowForm(true)}>
            + 新建预设
          </button>
        )}
      </div>
    </div>
  );
}
