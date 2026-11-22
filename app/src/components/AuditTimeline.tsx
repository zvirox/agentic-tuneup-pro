import React, { useState, useEffect } from "react";
import {
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { getAuditLog } from "../lib/ipc";
import { AuditEntry } from "../types";

export const AuditTimeline: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [initiatorFilter, setInitiatorFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logs = await getAuditLog(
        50,
        initiatorFilter === "all" ? undefined : initiatorFilter
      );
      setEntries(logs);
    } catch (err) {
      console.error("Failed to fetch audit log", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [initiatorFilter]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatTimestamp = (ts: number): string => {
    return new Date(ts * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRiskBadge = (tier: number) => {
    switch (tier) {
      case 1:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-signal-success-bg text-signal-success border border-signal-success/30">
            TIER 1 (SAFE)
          </span>
        );
      case 2:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-accent-muted text-accent border border-accent/30">
            TIER 2 (REVERSIBLE)
          </span>
        );
      case 3:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-signal-gate-bg text-signal-gate border border-signal-gate/30">
            TIER 3 (DESTRUCTIVE)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-text-primary">Audit Log &amp; Governance</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Cryptographically tracked trail of every system mutation, quarantine operation, and agent plan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-border-subtle text-xs font-medium">
            <button
              onClick={() => setInitiatorFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                initiatorFilter === "all"
                  ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setInitiatorFilter("starship")}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                initiatorFilter === "starship"
                  ? "bg-surface-glass-strong text-accent shadow-sm border border-accent/20"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Bot size={12} />
              <span>Agent</span>
            </button>
            <button
              onClick={() => setInitiatorFilter("user")}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                initiatorFilter === "user"
                  ? "bg-surface-glass-strong text-text-primary shadow-sm border border-border-glass"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <User size={12} />
              <span>User</span>
            </button>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            aria-label="Refresh audit entries"
            className="p-2 rounded-xl border border-border-glass text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Timeline List */}
      {entries.length === 0 ? (
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
          <Terminal size={32} className="text-text-disabled" />
          <h3 className="text-sm font-semibold text-text-primary">No audit records</h3>
          <p className="text-xs text-text-secondary max-w-sm">
            Operations executed by you or the Starship agent will be logged here with immutable timestamps.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.entry_id;
            const isAgent = entry.initiator === "starship" || entry.initiator === "agent";

            return (
              <div
                key={entry.entry_id}
                className="glass-panel p-3.5 rounded-xl flex flex-col gap-2 transition-all hover:border-border-focus/40"
              >
                <div
                  onClick={() => toggleExpand(entry.entry_id)}
                  className="flex items-center justify-between cursor-pointer select-none"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      toggleExpand(entry.entry_id);
                    }
                  }}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                        isAgent ? "bg-accent-muted text-accent" : "bg-white/10 text-text-primary"
                      }`}
                      title={isAgent ? "Starship Agent Initiated" : "User Initiated"}
                    >
                      {isAgent ? <Bot size={13} /> : <User size={13} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-text-primary">
                          {entry.action_type}
                        </span>
                        <span className="text-[11px] text-text-secondary">→ {entry.target}</span>
                      </div>
                      <span className="text-[10px] text-text-disabled font-mono block">
                        {formatTimestamp(entry.timestamp)} · #{entry.entry_id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {getRiskBadge(entry.risk_tier)}
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                        entry.status === "success"
                          ? "bg-signal-success-bg text-signal-success"
                          : "bg-signal-gate-bg text-signal-gate"
                      }`}
                    >
                      {entry.status}
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-text-secondary" />
                    ) : (
                      <ChevronDown size={14} className="text-text-secondary" />
                    )}
                  </div>
                </div>

                {/* Expanded Details JSON */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-border-subtle flex flex-col gap-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] text-text-secondary">
                      <span>Execution Details Payload</span>
                      <span className="font-mono text-[10px]">
                        Initiator: {entry.initiator}
                      </span>
                    </div>
                    <pre className="p-2.5 rounded-lg bg-black/60 border border-border-subtle font-mono text-[11px] text-text-primary overflow-x-auto">
                      {JSON.stringify(JSON.parse(entry.details_json || "{}"), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
