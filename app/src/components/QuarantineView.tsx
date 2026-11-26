import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Clock,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash,
} from "lucide-react";
import { listQuarantineSessions, purgeQuarantine } from "../lib/ipc";
import { QuarantineSessionRecord } from "../types";
import { UndoButton } from "./UndoButton";
import { LinearButton, LinearCard, LinearDialog, StatusPill } from "./linear";

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
      <LinearCard
        level={1}
        className="p-5 flex items-center justify-between border-l-4 border-l-[var(--primary)]"
      >
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary-tint text-primary-text flex items-center justify-center shrink-0">
            <Archive className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-fg">Quarantine Vault</h2>
            <p className="text-xs text-muted mt-0.5">
              Isolated storage for reversible deletion. Files are held for 7 days before automated purge.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs font-medium text-muted block">
              Quarantined Space
            </span>
            <span className="text-base font-semibold text-primary-text tabular-nums">
              {formatBytes(totalActiveBytes)}
            </span>
          </div>

          <LinearButton
            variant="secondary"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
            aria-label="Refresh quarantine sessions"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>Refresh</span>
          </LinearButton>
        </div>
      </LinearCard>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] pb-2.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer border ${
            filter === "all"
              ? "bg-[var(--bg-surface-2)] text-[var(--text)] border-[var(--border-strong)]"
              : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
          }`}
        >
          All Sessions ({sessions.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("active")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer border ${
            filter === "active"
              ? "bg-active text-primary-text border-border-strong"
              : "bg-transparent text-muted hover:text-fg border-transparent"
          }`}
        >
          Active Quarantined ({sessions.filter((s) => s.status === "active").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("restored")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer border ${
            filter === "restored"
              ? "bg-[var(--bg-surface-2)] text-[var(--text)] border-[var(--border-strong)]"
              : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] border-transparent"
          }`}
        >
          Restored &amp; Purged ({sessions.filter((s) => s.status !== "active").length})
        </button>
      </div>

      {/* Sessions List */}
      {filtered.length === 0 ? (
        <LinearCard level={1} className="p-8 flex flex-col items-center justify-center text-center gap-2">
          <ShieldAlert className="size-8 text-[var(--text-faint)]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[var(--text)]">No quarantine sessions found</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm">
            Files moved by the cleaner will appear here with instant one-click restoration.
          </p>
        </LinearCard>
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
              <LinearCard
                key={s.session_id}
                level={1}
                className="p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-medium text-[var(--text)]">
                      {s.session_id}
                    </span>
                    <StatusPill
                      label={s.status}
                      status={
                        s.status === "active"
                          ? "active"
                          : s.status === "restored"
                          ? "online"
                          : "idle"
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    <span className="font-semibold text-[var(--text)]">
                      {formatBytes(s.bytes_reclaimed)}
                    </span>
                    <span className="text-[var(--text-muted)]">· {s.file_count} files</span>
                  </div>
                </div>

                {/* Details & Actions */}
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2.5 border-t border-[var(--border)] gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Clock className="size-3.5 text-[var(--text-faint)]" aria-hidden="true" />
                      <span>{formatTimeRemaining(s.expires_at)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <Layers className="size-3.5 text-[var(--text-faint)] shrink-0" aria-hidden="true" />
                      <span className="font-mono truncate max-w-xs">
                        {ruleIds.join(", ")}
                      </span>
                    </div>
                  </div>

                  {s.status === "active" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <UndoButton
                        sessionId={s.session_id}
                        bytesCount={s.bytes_reclaimed}
                        filesCount={s.file_count}
                        onRestored={() => {
                          onNotify?.(`Session ${s.session_id} restored successfully.`);
                          fetchSessions();
                        }}
                      />

                      <LinearButton
                        variant="danger"
                        size="sm"
                        onClick={() => setPurgeTarget(s.session_id)}
                        aria-label={`Permanently purge session ${s.session_id}`}
                      >
                        <Trash className="size-3.5" aria-hidden="true" />
                        <span>Purge</span>
                      </LinearButton>
                    </div>
                  )}

                  {s.status === "restored" && (
                    <span className="text-xs text-sky-text font-medium inline-flex items-center gap-1 shrink-0">
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      Restored to original location
                    </span>
                  )}
                </div>
              </LinearCard>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Permanent Purge */}
      <LinearDialog
        open={Boolean(purgeTarget)}
        onClose={() => setPurgeTarget(null)}
        ariaLabel="Confirm Permanent Deletion"
        maxWidthClass="max-w-md"
        className="p-5 flex flex-col gap-4 border-red"
      >
        <div className="flex items-center gap-2.5 text-red-text font-semibold text-sm">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <span>Confirm Permanent Deletion</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Are you sure you want to permanently delete session{" "}
          <strong className="text-[var(--text)] font-mono">{purgeTarget}</strong>? This action is
          destructive and cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <LinearButton variant="secondary" size="sm" onClick={() => setPurgeTarget(null)}>
            Cancel
          </LinearButton>
          <LinearButton
            variant="danger"
            size="sm"
            onClick={() => purgeTarget && handlePurge(purgeTarget)}
          >
            Permanently Delete
          </LinearButton>
        </div>
      </LinearDialog>
    </div>
  );
};
