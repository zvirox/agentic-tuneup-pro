import React from "react";

export interface RangeTabsProps {
  options?: string[];
  active: string;
  onChange: (tab: string) => void;
  className?: string;
}

const DEFAULT_OPTIONS = ["1W", "1M", "3W", "YTD", "Total"];

export const RangeTabs: React.FC<RangeTabsProps> = ({
  options = DEFAULT_OPTIONS,
  active,
  onChange,
  className = "",
}) => {
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-surface-2 select-none ${className}`}
    >
      {options.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--primary-text)] cursor-pointer ${
              isActive
                ? "bg-active text-fg border border-border-strong shadow-card"
                : "text-muted hover:text-fg hover:bg-hover border border-transparent"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
};
