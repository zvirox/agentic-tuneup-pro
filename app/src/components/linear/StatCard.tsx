import React, { useId } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { LinearCard } from "./LinearCard";

export type StatTone = "blue" | "sky" | "green" | "red" | "amber" | "teal" | "purple" | "orange";

const TONE_CHIP_CLASSES: Record<StatTone, string> = {
  blue: "bg-[var(--tint-blue)] text-[var(--color-blue)]",
  sky: "bg-[var(--tint-sky)] text-[var(--color-sky)]",
  green: "bg-[var(--tint-green)] text-[var(--color-green)]",
  red: "bg-[var(--tint-red)] text-[var(--color-red)]",
  amber: "bg-[var(--tint-amber)] text-[var(--color-amber)]",
  teal: "bg-[var(--tint-teal)] text-[var(--color-teal)]",
  purple: "bg-[var(--tint-purple)] text-[var(--color-purple)]",
  orange: "bg-[var(--tint-orange)] text-[var(--color-orange)]",
};

export interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  tone?: StatTone;
  delta?: {
    value: string | number;
    positive?: boolean;
    comparison?: string;
  };
  sparklineData?: number[];
  sparklinePositive?: boolean;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  tone = "blue",
  delta,
  sparklineData,
  sparklinePositive = true,
  icon,
  className = "",
  onClick,
}) => {
  const gradId = useId();
  const strokeVar = sparklinePositive ? "var(--color-green)" : "var(--color-red)";

  const renderMiniSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null;
    const width = 92;
    const height = 28;
    const padding = 2;
    const maxVal = Math.max(...sparklineData, 1);
    const minVal = Math.min(...sparklineData, 0);
    const span = Math.max(maxVal - minVal, 1);

    const coords = sparklineData.map((val, idx) => {
      const x = padding + (idx / (sparklineData.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - minVal) / span) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const lineD = `M ${coords.join(" L ")}`;
    const firstX = coords[0].split(",")[0];
    const lastX = coords[coords.length - 1].split(",")[0];
    const areaD = `M ${firstX},${height} L ${coords.join(" L ")} L ${lastX},${height} Z`;

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-16 h-6 shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeVar} stopOpacity="0.22" />
            <stop offset="100%" stopColor={strokeVar} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={lineD}
          fill="none"
          stroke={strokeVar}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <LinearCard
      level={1}
      onClick={onClick}
      className={`p-5 flex flex-col justify-between ${
        onClick ? "cursor-pointer hover:border-[var(--border-strong)]" : ""
      } ${className}`}
    >
      {/* Top row: Title and Solid Icon Chip */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] select-none">
          {title}
        </span>
        {icon && (
          <div
            className={`size-7 rounded-md flex items-center justify-center shrink-0 ${TONE_CHIP_CLASSES[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Middle row: 28px Stat Metric + 12px Muted Unit + Sparkline */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[28px] font-semibold tracking-tight text-[var(--text)] tabular-nums font-sans leading-none shrink-0">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
              {unit}
            </span>
          )}
        </div>
        {renderMiniSparkline()}
      </div>

      {/* Bottom row: Solid Delta Tag + Comparison */}
      {delta && (
        <div className="mt-3.5 flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium tabular-nums shrink-0 ${
              delta.positive
                ? "bg-[var(--tint-green)] text-[var(--color-green)]"
                : "bg-[var(--tint-red)] text-[var(--color-red)]"
            }`}
          >
            {delta.positive ? (
              <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="size-3 shrink-0" aria-hidden="true" />
            )}
            {delta.value}
          </span>
          {delta.comparison && (
            <span className="text-xs text-[var(--text-muted)] truncate">
              {delta.comparison}
            </span>
          )}
        </div>
      )}
    </LinearCard>
  );
};
