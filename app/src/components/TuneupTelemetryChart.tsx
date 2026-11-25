import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { Activity } from "lucide-react";
import {
  LINEAR_SERIES_ORDER,
  LinearCard,
  RangeTabs,
  getLinearEChartsOption,
  useLinearTheme,
} from "./linear";

export interface TelemetrySeriesItem {
  name: string;
  data: number[];
  color?: string;
  unit?: string;
}

export interface TuneupTelemetryChartProps {
  title?: string;
  subtitle?: string;
  timestamps?: string[];
  series: TelemetrySeriesItem[];
  height?: string;
  className?: string;
}

const WINDOW_SLICES: Record<string, number> = {
  "1W": 7,
  "1M": 15,
  "3W": 20,
  YTD: 25,
  Total: 30,
};

export const TuneupTelemetryChart: React.FC<TuneupTelemetryChartProps> = ({
  title = "Live Hardware Telemetry",
  subtitle = "CPU load, memory utilization, and storage activity",
  series,
  height = "h-56",
  className = "",
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const theme = useLinearTheme();
  const isDark = theme === "dark";
  const [range, setRange] = useState<string>("Total");

  const pointLimit = WINDOW_SLICES[range] ?? 30;
  const maxLen = Math.max(...series.map((s) => Math.min(s.data.length, pointLimit)), 7);
  const computedLabels = Array.from({ length: maxLen }, (_, idx) => {
    const secAgo = maxLen - 1 - idx;
    return secAgo === 0 ? "now" : `-${secAgo}s`;
  });

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const baseOption = getLinearEChartsOption(isDark);
    const option = {
      ...baseOption,
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
      },
      xAxis: {
        ...baseOption.xAxis,
        type: "category",
        data: computedLabels,
        boundaryGap: false,
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        min: 0,
        max: 100,
      },
      series: series.map((s, idx) => {
        const lineColor = s.color ?? LINEAR_SERIES_ORDER[idx % LINEAR_SERIES_ORDER.length];
        const sliced = s.data.slice(-pointLimit);
        return {
          name: s.name,
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: lineColor },
          itemStyle: { color: lineColor },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: lineColor },
              { offset: 1, color: "transparent" },
            ]),
            opacity: 0.14,
          },
          data: sliced,
        };
      }),
    };

    chartInstance.current.setOption(option, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [series, isDark, pointLimit, computedLabels]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return (
    <LinearCard level={1} className={`p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-[var(--accent)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--text)] tracking-tight">
              {title}
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            {series.map((s, idx) => {
              const color =
                s.color ?? LINEAR_SERIES_ORDER[idx % LINEAR_SERIES_ORDER.length];
              return (
                <span key={s.name} className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span
                    className="size-2 rounded-[2px] shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span>{s.name}</span>
                </span>
              );
            })}
          </div>
          <RangeTabs active={range} onChange={setRange} />
        </div>
      </div>

      <div ref={chartRef} className={`w-full ${height}`} />
    </LinearCard>
  );
};
