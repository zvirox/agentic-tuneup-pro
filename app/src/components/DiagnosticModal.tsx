import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  HardDrive,
  Info,
  Layers,
  MemoryStick,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { diagnosticApplyFix, diagnosticRunAnalysis } from "../lib/ipc";
import { LinearButton, LinearDialog } from "./linear";
import type { BottleneckCategory, DiagnosticIssue, DiagnosticReport } from "../types";

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshTelemetry?: () => void;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  isOpen,
  onClose,
  onRefreshTelemetry,
}) => {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingAction, setApplyingAction] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await diagnosticRunAnalysis();
      setReport(data);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
      setActionNotice(null);
    }
  }, [isOpen]);

  const handleApplyFix = async (issue: DiagnosticIssue) => {
    if (!issue.remediation) return;
    const actionKey = `${issue.id}_${issue.remediation.action_type}`;
    setApplyingAction(actionKey);
    setActionNotice(null);

    try {
      const res = await diagnosticApplyFix(
        issue.remediation.action_type,
        issue.remediation.target ?? null
      );
      setActionNotice(`${res}`);
      await fetchDiagnostics();
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err: unknown) {
      setActionNotice(`Fix failed: ${typeof err === "string" ? err : (err as Error).message}`);
    } finally {
      setApplyingAction(null);
    }
  };

  const renderBottleneckTag = (cat: BottleneckCategory) => {
    switch (cat) {
      case "thermal_throttling":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-chip-red text-red-text border border-red">
            <Flame className="size-3.5" aria-hidden="true" /> Thermal Throttling
          </span>
        );
      case "cpu_saturation":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-surface-2 text-amber border border-border">
            <Cpu className="size-3.5" aria-hidden="true" /> CPU Contention
          </span>
        );
      case "memory_pressure":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-surface-2 text-purple border border-border">
            <MemoryStick className="size-3.5" aria-hidden="true" /> Memory Pressure
          </span>
        );
      case "disk_pressure":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-surface-2 text-amber border border-border">
            <HardDrive className="size-3.5" aria-hidden="true" /> Disk Storage Low
          </span>
        );
      case "background_indexer":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-primary-tint text-primary-text border border-border">
            <Search className="size-3.5" aria-hidden="true" /> Heavy Indexing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-chip-sky text-sky-text border border-border">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Nominal Performance
          </span>
        );
    }
  };

  return (
    <LinearDialog
      open={isOpen}
      onClose={onClose}
      titleId="diagnostic-title"
      maxWidthClass="max-w-2xl"
      className="overflow-hidden flex flex-col max-h-[85vh] p-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-md bg-primary-tint border border-border flex items-center justify-center text-primary-text">
            <Layers className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="diagnostic-title" className="text-sm font-semibold text-fg">
              Why is my PC slow?
            </h2>
            <p className="text-xs text-muted">
              Bottleneck correlation and one-click remedies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={fetchDiagnostics}
            disabled={loading}
            className="size-7 inline-flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-hover transition-colors duration-150 disabled:opacity-50 cursor-pointer"
            title="Re-run Diagnostic Analysis"
            aria-label="Refresh analysis"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="size-7 inline-flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-hover transition-colors duration-150 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {actionNotice && (
          <div className="p-3 rounded-md bg-primary-tint border border-primary text-xs text-fg flex items-center justify-between gap-2">
            <span>{actionNotice}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              aria-label="Dismiss notice"
              className="text-muted hover:text-fg cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="size-7 text-primary-text animate-spin mx-auto" aria-hidden="true" />
            <p className="text-[13px] text-muted">
              Correlating telemetry, process hogs &amp; thermals...
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-chip-red border border-red text-red-text text-xs">
            Failed to run diagnostic analysis: {error}
          </div>
        ) : report ? (
          <>
            {/* Primary Bottleneck Summary */}
            <div className="p-4 rounded-lg bg-surface-2 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-medium text-muted">
                  Primary Bottleneck
                </span>
                {renderBottleneckTag(report.primary_bottleneck)}
              </div>
              <p className="text-[13px] font-medium text-fg leading-relaxed">
                {report.headline}
              </p>
              <div className="flex items-center gap-4 pt-1 text-xs text-muted tabular-nums">
                <span>
                  Health Score:{" "}
                  <strong className="text-primary-text">{report.health_score}/100</strong>
                </span>
                <span>
                  Issues Diagnosed: <strong className="text-fg">{report.issues.length}</strong>
                </span>
              </div>
            </div>

            {/* Issues List */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-medium text-muted">
                Diagnosed Bottlenecks &amp; Fixes
              </h3>

              {report.issues.length === 0 ? (
                <div className="p-6 text-center rounded-lg bg-surface-2 border border-border space-y-2">
                  <CheckCircle2 className="size-7 text-sky mx-auto" aria-hidden="true" />
                  <p className="text-[13px] text-fg font-medium">
                    No system bottlenecks detected
                  </p>
                  <p className="text-xs text-muted">
                    Memory, CPU, storage, and temperatures are within nominal bounds.
                  </p>
                </div>
              ) : (
                report.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-4 rounded-lg bg-surface-2 border border-border space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {issue.severity === "critical" ? (
                          <AlertCircle className="size-4 text-red mt-0.5 shrink-0" aria-hidden="true" />
                        ) : issue.severity === "warning" ? (
                          <AlertTriangle className="size-4 text-amber mt-0.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <Info className="size-4 text-primary-text mt-0.5 shrink-0" aria-hidden="true" />
                        )}
                        <div>
                          <h4 className="text-[13px] font-semibold text-[var(--text)]">
                            {issue.title}
                          </h4>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                            {issue.description}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-mono text-[var(--text)] tabular-nums">
                        {issue.metric}
                      </span>
                    </div>

                    {issue.remediation && (
                      <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-3">
                        <span className="text-xs text-[var(--text-muted)]">
                          {issue.remediation.description}
                        </span>
                        <LinearButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleApplyFix(issue)}
                          disabled={
                            applyingAction === `${issue.id}_${issue.remediation.action_type}`
                          }
                        >
                          <Wrench className="size-3.5" aria-hidden="true" />
                          <span>
                            {applyingAction === `${issue.id}_${issue.remediation.action_type}`
                              ? "Applying..."
                              : issue.remediation.label}
                          </span>
                        </LinearButton>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-surface-2)] flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>Diagnosis generated from live /proc and system metrics.</span>
        <LinearButton variant="secondary" size="sm" onClick={onClose}>
          Done
        </LinearButton>
      </div>
    </LinearDialog>
  );
};
