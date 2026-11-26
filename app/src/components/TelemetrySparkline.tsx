import React, { useId } from "react";
import { LinearCard } from "./linear";

interface TelemetrySparklineProps {
  title: string;
  currentValue: string | number;
  unit?: string;
  subValue?: string;
  dataPoints: number[];
  maxValue?: number;
  color?: string;
  className?: string;
}

export const TelemetrySparkline: React.FC<TelemetrySparklineProps> = ({
  title,
  currentValue,
  unit = "",
  subValue,
  dataPoints,
  maxValue,
  color = "var(--sky)",
  className = "",
}) => {
  const gradId = useId();
  const width = 260;
  const height = 56;
  const padding = 4;

  const effectiveMax = maxValue ?? Math.max(...dataPoints, 1);
  const minVal = Math.min(...dataPoints, 0);

  const points = dataPoints.map((val, idx) => {
    const x = padding + (idx / Math.max(dataPoints.length - 1, 1)) * (width - 2 * padding);
    const normalized = (val - minVal) / Math.max(effectiveMax - minVal, 1);
    const y = height - padding - normalized * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = points.length > 0 ? `M ${points.join(" L ")}` : "";
  const areaD =
    points.length > 0
      ? `M ${points[0].split(",")[0]},${height} L ${points.join(" L ")} L ${
          points[points.length - 1].split(",")[0]
        },${height} Z`
      : "";

  return (
    <LinearCard
      level={1}
      className={`p-5 flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider whitespace-nowrap">
          {title}
        </span>
        {subValue && (
          <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded border border-[var(--border)] tabular-nums whitespace-nowrap shrink-0">
            {subValue}
          </span>
        )}
      </div>

      <div className="my-2 flex items-baseline gap-1.5">
        <span className="text-[28px] font-semibold text-[var(--text)] tabular-nums leading-none">
          {currentValue}
        </span>
        {unit && (
          <span className="text-xs font-medium text-[var(--text-muted)]">{unit}</span>
        )}
      </div>

      {/* Sparkline with permitted gradient fade under the line */}
      <div className="w-full h-14 relative overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.20" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    </LinearCard>
  );
};
