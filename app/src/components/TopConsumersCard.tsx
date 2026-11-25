import React from "react";
import { ArrowRight } from "lucide-react";
import { AppProcessGroup } from "../types";
import { LINEAR_SERIES_ORDER, LinearCard, ProgressRow } from "./linear";

interface TopConsumersCardProps {
  groups?: AppProcessGroup[];
  onNavigate?: (page: string) => void;
}

const FALLBACK_CONSUMERS = [
  { name: "firefox", detail: "Web Browser", cpuPercent: 24.1, memoryMb: 1840 },
  { name: "code", detail: "VS Code", cpuPercent: 11.3, memoryMb: 1220 },
  { name: "tracker-miner-fs", detail: "Search Indexer", cpuPercent: 4.2, memoryMb: 210 },
  { name: "gnome-shell", detail: "Compositor", cpuPercent: 3.5, memoryMb: 480 },
];

export const TopConsumersCard: React.FC<TopConsumersCardProps> = ({
  groups,
  onNavigate,
}) => {
  const rows =
    groups && groups.length > 0
      ? groups.slice(0, 4).map((g) => ({
          name: g.appName,
          detail: `${g.processCount} procs`,
          cpuPercent: Number(g.totalCpuPercent.toFixed(1)),
          memoryMb: Math.round(g.totalMemoryBytes / (1024 * 1024)),
        }))
      : FALLBACK_CONSUMERS;

  const maxCpu = Math.max(...rows.map((r) => r.cpuPercent), 25);

  return (
    <LinearCard level={1} className="p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Top Resource Consumers
        </h3>
        <button
          type="button"
          onClick={() => onNavigate?.("proc")}
          className="text-xs font-medium text-[var(--accent)] hover:underline inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-[var(--accent)] rounded cursor-pointer"
        >
          <span>Process Explorer</span>
          <ArrowRight className="size-3" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        {rows.map((proc, idx) => (
          <ProgressRow
            key={proc.name + idx}
            label={`${proc.name} (${proc.detail})`}
            value={(proc.cpuPercent / maxCpu) * 100}
            displayValue={`${proc.cpuPercent}% CPU · ${proc.memoryMb} MB`}
            color={LINEAR_SERIES_ORDER[idx % LINEAR_SERIES_ORDER.length]}
          />
        ))}
      </div>
    </LinearCard>
  );
};
