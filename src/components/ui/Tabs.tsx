import React from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "pills" | "underline";
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className = "",
  variant = "pills",
}: TabsProps) {
  if (variant === "underline") {
    return (
      <div className={`flex items-center gap-6 border-b border-zinc-200 ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative flex items-center gap-2 pb-3 text-xs font-bold transition ${
                isActive
                  ? "text-zinc-950 border-b-2 border-zinc-950"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    isActive
                      ? "bg-zinc-950 text-white"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-2xl bg-zinc-100 p-1.5 border border-zinc-200/80 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              isActive
                ? "bg-white text-zinc-950 shadow-xs border border-zinc-200/60"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/50"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  isActive
                    ? "bg-amber-400 text-cafe-950"
                    : "bg-zinc-300 text-zinc-800"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

