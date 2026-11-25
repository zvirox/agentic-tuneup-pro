import React from "react";

export interface ProgressRowProps {
  label: string;
  value: number; // 0 - 100
  displayValue?: string;
  color?: string;
  className?: string;
}

export const ProgressRow: React.FC<ProgressRowProps> = ({
  label,
  value,
  displayValue,
  color = "var(--color-blue)",
  className = "",
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[var(--text)] truncate">{label}</span>
        <span className="text-[var(--text-muted)] tabular-nums shrink-0">
          {displayValue ?? `${Math.round(clamped)}%`}
        </span>
      </div>
      <div className="h-1 w-full rounded-[2px] bg-[var(--bg-bar-idle)] overflow-hidden">
        <div
          className="h-full rounded-[2px] transition-[width] duration-150 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};
