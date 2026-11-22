import { CheckCircle2, XCircle, RotateCw, ShieldAlert, Sparkles, ArrowRight } from "lucide-react";
import { PlanStep } from "../types";

export function PlanStepCard({
  step,
  onApprove,
  onReject,
  executing,
}: {
  step: PlanStep;
  planId: string;
  onApprove: (stepIndex: number) => void;
  onReject: (stepIndex: number) => void;
  executing: boolean;
}) {
  const isWaiting = step.status === "waiting_approval";
  const isDone = step.status === "completed";
  const isFailed = step.status === "failed";
  const isRejected = step.status === "rejected";
  const isExecuting = step.status === "executing";

  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all text-xs ${
        isWaiting
          ? "bg-amber-950/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30"
          : isDone
          ? "bg-surface-glass border-emerald-500/30 text-text-primary"
          : isFailed
          ? "bg-red-950/30 border-red-500/40 text-text-primary"
          : isRejected
          ? "bg-surface-glass/40 border-border-subtle opacity-60 line-through"
          : "bg-surface-glass border-border-subtle text-text-primary"
      }`}
    >
      {/* Top Header: Step Number, Tool Name, Risk Tier Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-black/40 border border-border-subtle flex items-center justify-center font-mono text-[10px] text-text-muted">
            {step.step_index + 1}
          </span>
          <span className="font-mono text-[11px] font-bold text-accent truncate">
            {step.tool_name}
          </span>
        </div>

        {/* Risk Tier Badge */}
        <span
          className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${
            step.risk_tier === 1
              ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/40"
              : step.risk_tier === 2
              ? "bg-sky-950/40 text-sky-300 border-sky-800/40"
              : "bg-red-950/50 text-red-300 border-red-800/50 font-bold animate-pulse"
          }`}
        >
          {step.risk_tier === 1
            ? "Tier 1 · Safe"
            : step.risk_tier === 2
            ? "Tier 2 · Reversible"
            : "Tier 3 · Mutating"}
        </span>
      </div>

      {/* Description */}
      <div className="mt-2 text-text-secondary leading-relaxed">
        {step.description}
      </div>

      {/* Diff / Storage summary */}
      {step.diff_summary && (
        <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-black/40 border border-border-subtle font-mono text-[11px] text-accent flex items-center gap-1.5">
          <ArrowRight size={12} className="text-accent" />
          <span>{step.diff_summary}</span>
        </div>
      )}

      {/* Footer State & Interactive Approval Gate */}
      <div className="mt-3 pt-2.5 border-t border-border-subtle/50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          {isDone && (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Completed
            </span>
          )}
          {isExecuting && (
            <span className="text-accent flex items-center gap-1">
              <RotateCw size={13} className="animate-spin" /> Executing step...
            </span>
          )}
          {isFailed && (
            <span className="text-red-400 flex items-center gap-1">
              <XCircle size={13} /> Step execution failed
            </span>
          )}
          {isRejected && (
            <span className="text-text-disabled flex items-center gap-1">
              <XCircle size={13} /> Rejected by user
            </span>
          )}
          {step.status === "pending" && (
            <span className="text-text-muted flex items-center gap-1 font-mono text-[10px]">
              Ready to dispatch
            </span>
          )}
          {isWaiting && (
            <span className="text-amber-400 flex items-center gap-1 font-semibold">
              <ShieldAlert size={14} className="animate-pulse" /> Awaiting Consent Gate
            </span>
          )}
        </div>

        {/* Approval buttons when WaitingApproval */}
        {isWaiting && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReject(step.step_index)}
              disabled={executing}
              className="px-2.5 py-1 rounded-lg border border-border-subtle bg-surface-glass text-[11px] text-text-secondary hover:text-red-400 hover:border-red-900 transition-all cursor-pointer disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(step.step_index)}
              disabled={executing}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <Sparkles size={11} />
              <span>Approve</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
