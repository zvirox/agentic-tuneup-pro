import React from "react";
import { HealthScore } from "../types";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface HealthGaugeProps {
  health: HealthScore;
  onNavigate?: (page: string) => void;
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({ health, onNavigate }) => {
  const { score, rating, deductions } = health;

  // Gauge calculations for SVG circle
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Use a 270-degree arc for dashboard speedometer look
  const arcPercentage = 0.75;
  const maxArcLength = circumference * arcPercentage;
  const strokeDashoffset = maxArcLength - (score / 100) * maxArcLength;

  // Colors based on score
  const getThemeColor = () => {
    if (score >= 85) return "#10B981"; // Emerald
    if (score >= 65) return "#F59E0B"; // Amber
    return "#F43F5E"; // Rose
  };

  const themeColor = getThemeColor();

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium tracking-wider text-text-secondary">
          System health score
        </span>
        <span className="text-[11px] font-mono font-medium" style={{ color: themeColor }}>
          {rating}
        </span>
      </div>

      <div className="flex items-center gap-6 my-2">
        {/* Radial Gauge SVG */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            width={size}
            height={size}
            className="transform -rotate-135"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`System health score: ${score} out of 100 (${rating})`}
          >
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${maxArcLength} ${circumference}`}
              strokeLinecap="round"
            />
            {/* Progress Stroke */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={themeColor}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${maxArcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>

          {/* Centered Readout */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span
              className="font-mono text-3xl font-semibold tracking-tight"
              style={{ color: themeColor }}
            >
              {score}
            </span>
            <span className="text-[10px] text-text-secondary font-semibold">
              / 100
            </span>
          </div>
        </div>

        {/* Deductions / Opportunities */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {deductions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-signal-success font-medium">
              <CheckCircle2 size={16} />
              <span>Optimal system state. Zero performance deductions.</span>
            </div>
          ) : (
            deductions.map((d, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-border-subtle text-xs gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-signal-gate shrink-0 tabular-nums">
                    −{d.points}
                  </span>
                  <span className="truncate text-text-secondary text-[11px]" title={d.reason}>
                    {d.reason}
                  </span>
                </div>
                <button
                  onClick={() => onNavigate?.(d.target_page)}
                  className="text-[11px] font-semibold text-accent hover:text-accent-hover flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <span>{d.action_label}</span>
                  <ArrowRight size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
