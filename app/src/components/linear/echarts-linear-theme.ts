export function getCssToken(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function resolveCssColor(tokenOrValue: string): string {
  const trimmed = tokenOrValue.trim();
  const match = /^var\((--[^)]+)\)$/.exec(trimmed);
  const token = match ? match[1] : trimmed.startsWith("--") ? trimmed : "";
  return token ? getCssToken(token) : trimmed;
}

export const LINEAR_SERIES_TOKENS = [
  "--primary",
  "--sky",
  "--amber",
  "--pink",
  "--purple",
] as const;

export function getLinearSeriesOrder(): string[] {
  return LINEAR_SERIES_TOKENS.map((token) => getCssToken(token));
}

export function getLinearEChartsOption() {
  const textMuted = getCssToken("--text-muted");
  const border = getCssToken("--border");
  const borderStrong = getCssToken("--border-strong");
  const chartGrid = getCssToken("--chart-grid");
  const surface2 = getCssToken("--bg-surface-2");
  const textFg = getCssToken("--text");

  return {
    backgroundColor: "transparent",
    textStyle: {
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      fontSize: 12,
      color: textMuted,
    },
    grid: {
      top: 20,
      right: 16,
      bottom: 24,
      left: 44,
      borderColor: border,
    },
    tooltip: {
      backgroundColor: surface2,
      borderColor: borderStrong,
      borderWidth: 1,
      borderRadius: 4,
      padding: [8, 10],
      textStyle: {
        color: textFg,
        fontSize: 12,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      },
      extraCssText: "box-shadow: var(--shadow-card);",
    },
    xAxis: {
      axisLine: {
        lineStyle: { color: border },
      },
      axisLabel: {
        fontSize: 12,
        color: textMuted,
      },
      splitLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisLabel: {
        fontSize: 12,
        color: textMuted,
      },
      splitLine: {
        lineStyle: {
          type: "dotted" as const,
          color: chartGrid,
        },
      },
    },
    color: getLinearSeriesOrder(),
  };
}
