import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
      const data = await invoke<DiagnosticReport>("diagnostic_run_analysis");
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

  // Esc key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleApplyFix = async (issue: DiagnosticIssue) => {
    if (!issue.remediation) return;
    const actionKey = `${issue.id}_${issue.remediation.action_type}`;
    setApplyingAction(actionKey);
    setActionNotice(null);

    try {
      const res = await invoke<string>("diagnostic_apply_fix", {
        actionType: issue.remediation.action_type,
        target: issue.remediation.target ?? null,
      });
      setActionNotice(`✔ ${res}`);
      // Refresh diagnostics and dashboard
      await fetchDiagnostics();
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err: unknown) {
      setActionNotice(`❌ Fix failed: ${typeof err === "string" ? err : (err as Error).message}`);
    } finally {
      setApplyingAction(null);
    }
  };

  if (!isOpen) return null;

  const renderBottleneckBadge = (cat: BottleneckCategory) => {
    switch (cat) {
      case "thermal_throttling":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/30">
            <Flame className="w-3.5 h-3.5" /> Thermal Throttling
          </span>
        );
      case "cpu_saturation":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            <Cpu className="w-3.5 h-3.5" /> CPU Contention
          </span>
        );
      case "memory_pressure":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30">
            <MemoryStick className="w-3.5 h-3.5" /> Memory Pressure
          </span>
        );
      case "disk_pressure":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            <HardDrive className="w-3.5 h-3.5" /> Disk Storage Low
          </span>
        );
      case "background_indexer":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
            <Search className="w-3.5 h-3.5" /> Heavy Indexing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Nominal Performance
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostic-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl bg-[#0E131B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="diagnostic-title" className="text-base font-semibold text-[#F1F5F9]">
                Why is my PC slow?
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Intelligent bottleneck correlation & one-click remedies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Re-run Diagnostic Analysis"
              aria-label="Refresh analysis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionNotice && (
            <div className="p-3 rounded-xl bg-white/[0.04] border border-[#38BDF8]/30 text-xs text-[#F1F5F9] flex items-center justify-between">
              <span>{actionNotice}</span>
              <button
                onClick={() => setActionNotice(null)}
                className="text-[#94A3B8] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#38BDF8] animate-spin mx-auto" />
              <p className="text-sm text-[#94A3B8]">Correlating telemetry, process hogs & thermals...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#F43F5E] text-sm">
              Failed to run diagnostic analysis: {error}
            </div>
          ) : report ? (
            <>
              {/* Primary Bottleneck Headline Card */}
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[#94A3B8]">
                    Primary Bottleneck
                  </span>
                  {renderBottleneckBadge(report.primary_bottleneck)}
                </div>
                <p className="text-sm font-medium text-[#F1F5F9] leading-relaxed">
                  {report.headline}
                </p>
                <div className="flex items-center gap-4 pt-1 text-xs text-[#94A3B8]">
                  <span>Health Score: <strong className="text-[#38BDF8]">{report.health_score}/100</strong></span>
                  <span>Issues Diagnosed: <strong>{report.issues.length}</strong></span>
                </div>
              </div>

              {/* Issues List */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#94A3B8]">
                  Diagnosed Bottlenecks & Fixes
                </h3>

                {report.issues.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto" />
                    <p className="text-sm text-[#F1F5F9] font-medium">No system bottlenecks detected</p>
                    <p className="text-xs text-[#94A3B8]">
                      Memory, CPU, storage, and temperatures are well within optimal bounds.
                    </p>
                  </div>
                ) : (
                  report.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          {issue.severity === "critical" ? (
                            <AlertCircle className="w-4 h-4 text-[#F43F5E] mt-0.5 shrink-0" />
                          ) : issue.severity === "warning" ? (
                            <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 text-[#38BDF8] mt-0.5 shrink-0" />
                          )}
                          <div>
                            <h4 className="text-sm font-medium text-[#F1F5F9]">
                              {issue.title}
                            </h4>
                            <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">
                              {issue.description}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono text-[#F1F5F9]">
                          {issue.metric}
                        </span>
                      </div>

                      {issue.remediation && (
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span className="text-xs text-[#94A3B8]">
                            {issue.remediation.description}
                          </span>
                          <button
                            onClick={() => handleApplyFix(issue)}
                            disabled={applyingAction === `${issue.id}_${issue.remediation.action_type}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#38BDF8]/15 text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#080B10] border border-[#38BDF8]/30 transition-all disabled:opacity-50"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            {applyingAction === `${issue.id}_${issue.remediation.action_type}`
                              ? "Applying..."
                              : issue.remediation.label}
                          </button>
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
        <div className="px-6 py-3.5 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-xs text-[#94A3B8]">
          <span>Diagnosis generated from live /proc and system metrics.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[#F1F5F9] font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
