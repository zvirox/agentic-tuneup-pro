import React from "react";
import { ArrowRight, Terminal } from "lucide-react";
import { LinearCard } from "./linear/LinearCard";

interface ConsumerItem {
  name: string;
  subtext: string;
  cpuPercent: number;
  memoryMb: number;
}

interface TopConsumersCardProps {
  onNavigate?: (page: string) => void;
}

export const TopConsumersCard: React.FC<TopConsumersCardProps> = ({ onNavigate }) => {
  const consumers: ConsumerItem[] = [
    {
      name: "firefox",
      subtext: "Web Browser (34 tabs)",
      cpuPercent: 24.1,
      memoryMb: 1840,
    },
    {
      name: "code",
      subtext: "VS Code (Rust Analyzer)",
      cpuPercent: 11.3,
      memoryMb: 1220,
    },
    {
      name: "tracker-miner-fs",
      subtext: "GNOME Search Indexer",
      cpuPercent: 4.2,
      memoryMb: 210,
    },
    {
      name: "gnome-shell",
      subtext: "Compositor & Window Manager",
      cpuPercent: 3.5,
      memoryMb: 480,
    },
  ];

  return (
    <LinearCard level="raised" className="p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium tracking-wider text-text-secondary">
          Top resource consumers
        </h3>
        <button
          onClick={() => onNavigate?.("proc")}
          className="text-xs font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Process Explorer</span>
          <ArrowRight size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {consumers.map((proc, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-border-subtle text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-text-secondary shrink-0">
                <Terminal size={12} />
              </div>
              <div className="min-w-0">
                <span className="font-medium text-text-primary block truncate font-mono text-xs">
                  {proc.name}
                </span>
                <span className="text-[10px] text-text-secondary truncate block">
                  {proc.subtext}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
              <span className="text-text-primary font-medium tabular-nums">{proc.cpuPercent}% CPU</span>
              <span className="text-text-secondary">{proc.memoryMb} MB</span>
            </div>
          </div>
        ))}
      </div>
    </LinearCard>
  );
};
