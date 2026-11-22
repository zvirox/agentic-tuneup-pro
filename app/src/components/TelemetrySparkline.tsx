import React from "react";

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
  color = "#38BDF8", // Electric Cyan
  className = "",
}) => {
  const width = 280;
  const height = 64;
  const padding = 4;

  const effectiveMax = maxValue ?? Math.max(...dataPoints, 1);
  const minVal = Math.min(...dataPoints, 0);

  // Generate SVG polyline coordinates
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

  const gradId = `sparkline-grad-${title.replace(/\s+/g, "").toLowerCase()}`;

  return (
    <div
      className={`glass-panel p-4 rounded-2xl flex flex-col justify-between ${className}`}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary font-semibold uppercase tracking-wider">
          {title}
        </span>
        {subValue && (
          <span className="font-mono text-[11px] text-text-secondary bg-white/5 px-1.5 py-0.5 rounded border border-border-subtle">
            {subValue}
          </span>
        )}
      </div>

      {/* Main Metric */}
      <div className="my-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-text-primary">
          {currentValue}
          {unit && <span className="text-sm font-normal text-text-secondary ml-0.5">{unit}</span>}
        </span>
      </div>

      {/* SVG Canvas Area */}
      <div className="w-full h-16 relative overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area under curve */}
          {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

          {/* Sparkline curve */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
