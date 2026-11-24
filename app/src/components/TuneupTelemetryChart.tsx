import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { getLinearEChartsOption } from "./linear/echarts-linear-theme";
import { LinearCard } from "./linear/LinearCard";
import { Activity } from "lucide-react";

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
  isDark?: boolean;
}

export const TuneupTelemetryChart: React.FC<TuneupTelemetryChartProps> = ({
  title = "Real-Time Resource Telemetry",
  subtitle = "High-precision hardware memory, storage I/O, and CPU load stream",
  timestamps = ["-60s", "-50s", "-40s", "-30s", "-20s", "-10s", "now"],
  series,
  height = "h-56",
  className = "",
  isDark = true,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

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
        valueFormatter: (value: any) => `${value}`,
      },
      xAxis: {
        ...baseOption.xAxis,
        type: "category",
        data: timestamps,
        boundaryGap: false,
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        splitLine: {
          lineStyle: {
            color: isDark ? "#23232a" : "#e2e2e7",
          },
        },
      },
      series: series.map((s, idx) => ({
        name: s.name,
        type: "line",
        smooth: true,
        showSymbol: false,
        areaStyle: {
          opacity: 0.12,
        },
        data: s.data,
        color: s.color || (idx === 0 ? "#a855f7" : idx === 1 ? "#38bdf8" : "#10b981"),
      })),
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [timestamps, series, isDark]);

  return (
    <LinearCard level="raised" className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3 border-b border-border-subtle pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <h4 className="text-xs font-semibold text-text-primary tracking-tight">{title}</h4>
          </div>
          <p className="text-[11px] text-text-secondary">{subtitle}</p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          {series.map((s, idx) => (
            <span key={s.name} className="flex items-center gap-1.5 text-text-secondary">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    s.color || (idx === 0 ? "#a855f7" : idx === 1 ? "#38bdf8" : "#10b981"),
                }}
              />
              <span className="font-sans text-[11px]">{s.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div ref={chartRef} className={`w-full ${height}`} />
    </LinearCard>
  );
};
