"use client";

import { CATEGORIES, CATEGORY_ICONS, type Category } from "~~/lib/constants";

interface CategoryTabsProps {
  active: Category;
  onChange: (cat: Category) => void;
}

export const CategoryTabs = ({ active, onChange }: CategoryTabsProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5"
          style={{
            backgroundColor: active === cat ? "#30363d" : "transparent",
            color: active === cat ? "#e6edf3" : "#8b949e",
            border: active === cat ? "1px solid #484f58" : "1px solid transparent",
          }}
        >
          <span>{CATEGORY_ICONS[cat]}</span>
          <span>{cat}</span>
        </button>
      ))}
    </div>
  );
};
