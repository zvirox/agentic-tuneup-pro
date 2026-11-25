import React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { HealthScore } from "../types";
import { DonutLegend, LinearCard, StatusPill } from "./linear";

interface HealthGaugeProps {
  health: HealthScore;
  onNavigate?: (page: string) => void;
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({ health, onNavigate }) => {
  const { score, rating, deductions } = health;

  const size = 148;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcPercentage = 0.78;
  const maxArcLength = circumference * arcPercentage;
  const strokeDashoffset = maxArcLength - (score / 100) * maxArcLength;

  const strokeToken =
    score >= 85
      ? "var(--color-green)"
      : score >= 65
      ? "var(--color-amber)"
      : "var(--color-red)";

  const statusTone =
    score >= 85 ? "online" : score >= 65 ? "warning" : "alert";

  const legendItems =
    deductions.length > 0
      ? deductions.map((d, idx) => ({
          label: d.category,
          value: `−${d.points} pts`,
          color:
            idx === 0
              ? "var(--color-amber)"
              : idx === 1
              ? "var(--color-sky)"
              : "var(--color-red)",
        }))
      : [
          {
            label: "System headroom",
            value: `${score}%`,
            color: "var(--color-green)",
          },
          {
            label: "Active deductions",
            value: "0 pts",
            color: "var(--color-blue)",
          },
        ];

  return (
    <LinearCard level={1} className="p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          System Health Score
        </span>
        <StatusPill label={rating.toUpperCase()} status={statusTone} />
      </div>

      <div className="flex items-center gap-6">
        {/* Donut Gauge with thin tick ring & rounded arc ends */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            width={size}
            height={size}
            className="transform -rotate-[140deg]"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`System health score: ${score} out of 100 (${rating})`}
          >
            {/* Outer subtle tick ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius + 6}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="2 5"
              fill="transparent"
            />
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--bg-bar-idle)"
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
              stroke={strokeToken}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${maxArcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-150 ease-out"
            />
          </svg>

          {/* Centered Metric */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span
              className="text-[28px] font-semibold tracking-tight tabular-nums leading-none"
              style={{ color: strokeToken }}
            >
              {score}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium mt-1">
              / 100
            </span>
          </div>
        </div>

        {/* Legend + Actionable Deductions */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <DonutLegend items={legendItems} />

          {deductions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-[var(--color-green)] font-medium pt-1">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              <span>Optimal system state. Zero deductions.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {deductions.map((d, idx) => (
                <div
                  key={d.category + idx}
                  className="flex flex-col gap-1 px-2.5 py-2 rounded-md bg-[var(--bg-surface-2)] border border-[var(--border)] text-xs"
                >
                  <span className="text-[var(--text-muted)] leading-snug">
                    {d.reason}
                  </span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onNavigate?.(d.target_page)}
                      className="text-xs font-medium text-[var(--accent)] hover:underline inline-flex items-center gap-1 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--accent)] rounded cursor-pointer"
                    >
                      <span>{d.action_label}</span>
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </LinearCard>
  );
};
