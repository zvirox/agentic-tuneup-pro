import React, { useEffect, useState } from "react";
import { Bot, ChevronDown, ChevronUp, RefreshCw, Terminal, User } from "lucide-react";
import { getAuditLog } from "../lib/ipc";
import { AuditEntry } from "../types";
import { LinearButton, LinearCard, StatusPill } from "./linear";

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
          <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-chip-sky text-sky-text border border-border">
            Tier 1 · Safe
          </span>
        );
      case 2:
        return (
          <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-primary-tint text-primary-text border border-border">
            Tier 2 · Reversible
          </span>
        );
      case 3:
        return (
          <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-chip-red text-red-text border border-red">
            Tier 3 · Destructive
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">
            Audit Log &amp; Governance
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Tracked trail of every system mutation, quarantine operation, and agent plan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--bg-surface-2)] p-0.5 rounded-md border border-[var(--border)] text-xs font-medium">
            <button
              type="button"
              onClick={() => setInitiatorFilter("all")}
              className={`px-2.5 py-1 rounded transition-colors duration-150 cursor-pointer border ${
                initiatorFilter === "all"
                  ? "bg-[var(--bg-surface)] text-[var(--text)] border-[var(--border)]"
                  : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setInitiatorFilter("starship")}
              className={`px-2.5 py-1 rounded transition-colors duration-150 inline-flex items-center gap-1 cursor-pointer border ${
                initiatorFilter === "starship"
                  ? "bg-active text-primary-text border-border-strong"
                  : "bg-transparent text-muted hover:text-fg border-transparent"
              }`}
            >
              <Bot className="size-3" aria-hidden="true" />
              <span>Agent</span>
            </button>
            <button
              type="button"
              onClick={() => setInitiatorFilter("user")}
              className={`px-2.5 py-1 rounded transition-colors duration-150 inline-flex items-center gap-1 cursor-pointer border ${
                initiatorFilter === "user"
                  ? "bg-[var(--bg-surface)] text-[var(--text)] border-[var(--border)]"
                  : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
              }`}
            >
              <User className="size-3" aria-hidden="true" />
              <span>User</span>
            </button>
          </div>

          <LinearButton
            variant="secondary"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            aria-label="Refresh audit entries"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </LinearButton>
        </div>
      </div>

      {/* Timeline List */}
      {entries.length === 0 ? (
        <LinearCard level={1} className="p-8 flex flex-col items-center justify-center text-center gap-2">
          <Terminal className="size-7 text-[var(--text-faint)]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[var(--text)]">No audit records</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm">
            Operations executed by you or the Starship agent will be logged here with timestamps.
          </p>
        </LinearCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.entry_id;
            const isAgent = entry.initiator === "starship" || entry.initiator === "agent";

            return (
              <LinearCard key={entry.entry_id} level={1} className="p-3.5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(entry.entry_id)}
                  aria-expanded={isExpanded}
                  className="flex items-center justify-between w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--primary-text)] rounded"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`size-6 rounded flex items-center justify-center shrink-0 ${
                        isAgent
                          ? "bg-primary-tint text-primary-text"
                          : "bg-surface-2 text-fg"
                      }`}
                      title={isAgent ? "Starship Agent Initiated" : "User Initiated"}
                    >
                      {isAgent ? (
                        <Bot className="size-3.5" aria-hidden="true" />
                      ) : (
                        <User className="size-3.5" aria-hidden="true" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-[var(--text)] truncate">
                          {entry.action_type}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] truncate">
                          → {entry.target}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--text-faint)] font-mono block tabular-nums">
                        {formatTimestamp(entry.timestamp)} · #{entry.entry_id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getRiskBadge(entry.risk_tier)}
                    <StatusPill
                      label={entry.status}
                      status={entry.status === "success" ? "online" : "alert"}
                    />
                    {isExpanded ? (
                      <ChevronUp className="size-3.5 text-[var(--text-muted)]" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-3.5 text-[var(--text-muted)]" aria-hidden="true" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-2 pt-2.5 border-t border-[var(--border)] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span>Execution Details Payload</span>
                      <span className="font-mono text-[11px]">
                        Initiator: {entry.initiator}
                      </span>
                    </div>
                    <pre className="p-2.5 rounded-md bg-[var(--bg-surface-2)] border border-[var(--border)] font-mono text-xs text-[var(--text)] overflow-x-auto select-text">
                      {JSON.stringify(JSON.parse(entry.details_json || "{}"), null, 2)}
                    </pre>
                  </div>
                )}
              </LinearCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
