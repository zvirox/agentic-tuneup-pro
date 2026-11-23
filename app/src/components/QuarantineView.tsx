import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Archive,
  RotateCcw,
  Trash,
  Clock,
  Layers,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { listQuarantineSessions, purgeQuarantine } from "../lib/ipc";
import { QuarantineSessionRecord } from "../types";
import { UndoButton } from "./UndoButton";

interface QuarantineViewProps {
  onNotify?: (msg: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatTimeRemaining(expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diffSec = expiresAt - now;
  if (diffSec <= 0) return "Expired (Scheduled for purge)";
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

export const QuarantineView: React.FC<QuarantineViewProps> = ({ onNotify }) => {
  const [sessions, setSessions] = useState<QuarantineSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "restored">("all");
  const [purgeTarget, setPurgeTarget] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const records = await listQuarantineSessions();
      setSessions(records);
    } catch (err) {
      console.error("Failed to fetch quarantine sessions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handlePurge = async (sessionId: string) => {
    try {
      const bytes = await purgeQuarantine(sessionId);
      onNotify?.(`Permanently purged ${formatBytes(bytes)} from session ${sessionId}`);
      setPurgeTarget(null);
      fetchSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify?.(`Purge failed: ${msg}`);
    }
  };

  const filtered = sessions.filter((s) => {
    if (filter === "active") return s.status === "active";
    if (filter === "restored") return s.status === "restored" || s.status === "purged";
    return true;
  });

  const totalActiveBytes = sessions
    .filter((s) => s.status === "active")
    .reduce((acc, curr) => acc + curr.bytes_reclaimed, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Overview Banner */}
      <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-accent">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center text-accent">
            <Archive size={20} />
          </div>
          <div>
            <h2 className="text-sm font-medium text-text-primary">Quarantine Vault</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Isolated storage for reversible deletion. Files are held for 7 days before automated purge.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-semibold text-text-secondary tracking-wider block">
              Quarantined Space
            </span>
            <span className="font-mono text-base font-medium text-accent">
              {formatBytes(totalActiveBytes)}
            </span>
          </div>

          <button
            onClick={fetchSessions}
            disabled={loading}
            aria-label="Refresh quarantine sessions"
            className="p-2 rounded-xl border border-border-glass text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "all"
              ? "bg-surface-glass-strong text-text-primary border border-border-glass shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          All Sessions ({sessions.length})
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "active"
              ? "bg-surface-glass-strong text-accent border border-accent/20 shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Active Quarantined ({sessions.filter((s) => s.status === "active").length})
        </button>
        <button
          onClick={() => setFilter("restored")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "restored"
              ? "bg-surface-glass-strong text-text-primary border border-border-glass shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Restored &amp; Purged ({sessions.filter((s) => s.status !== "active").length})
        </button>
      </div>

      {/* Sessions List */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
          <ShieldAlert size={32} className="text-text-disabled" />
          <h3 className="text-sm font-semibold text-text-primary">No quarantine sessions found</h3>
          <p className="text-xs text-text-secondary max-w-sm">
            Files moved by the cleaner will appear here with instant one-click restoration.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((s) => {
            let ruleIds: string[] = [];
            try {
              ruleIds = JSON.parse(s.rule_ids_json);
            } catch {
              ruleIds = [s.rule_ids_json];
            }

            return (
              <div
                key={s.session_id}
                className="glass-panel p-4 rounded-2xl flex flex-col gap-3 transition-colors hover:border-border-focus/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-text-primary">
                      {s.session_id}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                        s.status === "active"
                          ? "bg-accent-muted text-accent border border-accent/30"
                          : s.status === "restored"
                          ? "bg-signal-success-bg text-signal-success border border-signal-success/30"
                          : "bg-white/10 text-text-disabled"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="font-medium text-text-primary">
                      {formatBytes(s.bytes_reclaimed)}
                    </span>
                    <span className="text-text-secondary">· {s.file_count} files</span>
                  </div>
                </div>

                {/* Details & Rules */}
                <div className="flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-border-subtle">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-text-disabled" />
                      <span>{formatTimeRemaining(s.expires_at)}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Layers size={13} className="text-text-disabled" />
                      <span className="font-mono text-[11px] truncate max-w-xs">
                        {ruleIds.join(", ")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {s.status === "active" && (
                    <div className="flex items-center gap-2">
                      <UndoButton
                        sessionId={s.session_id}
                        bytesCount={s.bytes_reclaimed}
                        filesCount={s.file_count}
                        onRestored={() => {
                          onNotify?.(`Session ${s.session_id} restored successfully.`);
                          fetchSessions();
                        }}
                      />

                      <button
                        onClick={() => setPurgeTarget(s.session_id)}
                        aria-label={`Permanently purge session ${s.session_id}`}
                        className="px-2.5 py-1.5 rounded-xl border border-signal-gate/20 hover:bg-signal-gate-bg text-signal-gate text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash size={13} />
                        <span>Purge</span>
                      </button>
                    </div>
                  )}

                  {s.status === "restored" && (
                    <span className="text-[11px] text-signal-success font-medium flex items-center gap-1">
                      <RotateCcw size={12} />
                      Restored to original location
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Permanent Purge */}
      {purgeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="glass-panel-strong p-5 rounded-2xl max-w-md w-full border border-signal-gate/40 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-signal-gate font-medium text-sm">
              <AlertTriangle size={20} />
              <span>Confirm Permanent Deletion</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to permanently delete session{" "}
              <strong className="text-text-primary font-mono">{purgeTarget}</strong>? This action
              is destructive and cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPurgeTarget(null)}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePurge(purgeTarget)}
                className="px-4 py-1.5 rounded-xl bg-signal-gate hover:bg-signal-gate/90 text-white text-xs font-medium shadow-lg transition-colors cursor-pointer"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
