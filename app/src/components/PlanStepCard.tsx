import {
  ArrowRight,
  CheckCircle2,
  RotateCw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { PlanStep } from "../types";
import { LinearButton, LinearCard } from "./linear";

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

  const cardBorder = isWaiting
    ? "border-amber bg-surface-2"
    : isDone
    ? "border-sky"
    : isFailed
    ? "border-red bg-chip-red"
    : isRejected
    ? "opacity-60 line-through"
    : "";

  const tierTag =
    step.risk_tier === 1
      ? "bg-chip-sky text-sky-text border-border"
      : step.risk_tier === 2
      ? "bg-primary-tint text-primary-text border-border"
      : "bg-chip-red text-red-text border-red font-semibold";

  return (
    <LinearCard level={1} className={`p-3.5 text-xs ${cardBorder}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-5 rounded bg-surface-2 border border-border flex items-center justify-center font-mono text-[11px] text-muted shrink-0 tabular-nums">
            {step.step_index + 1}
          </span>
          <span className="font-mono text-xs font-medium text-primary-text truncate">
            {step.tool_name}
          </span>
        </div>

        <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${tierTag}`}>
          {step.risk_tier === 1
            ? "Tier 1 · Safe"
            : step.risk_tier === 2
            ? "Tier 2 · Reversible"
            : "Tier 3 · Destructive"}
        </span>
      </div>

      {/* Description */}
      <div className="mt-2 text-muted leading-relaxed">{step.description}</div>

      {/* Diff summary */}
      {step.diff_summary && (
        <div className="mt-2 px-2.5 py-1.5 rounded-md bg-surface-2 border border-border font-mono text-xs text-primary-text flex items-center gap-1.5">
          <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
          <span>{step.diff_summary}</span>
        </div>
      )}

      {/* Footer State & Approval Gate */}
      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {isDone && (
            <span className="text-sky-text inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Completed
            </span>
          )}
          {isExecuting && (
            <span className="text-primary-text inline-flex items-center gap-1">
              <RotateCw className="size-3.5 animate-spin" aria-hidden="true" /> Executing step...
            </span>
          )}
          {isFailed && (
            <span className="text-red-text inline-flex items-center gap-1">
              <XCircle className="size-3.5" aria-hidden="true" /> Step failed
            </span>
          )}
          {isRejected && (
            <span className="text-faint inline-flex items-center gap-1">
              <XCircle className="size-3.5" aria-hidden="true" /> Rejected by user
            </span>
          )}
          {step.status === "pending" && (
            <span className="text-muted font-mono text-[11px]">
              Ready to dispatch
            </span>
          )}
          {isWaiting && (
            <span className="text-amber inline-flex items-center gap-1 font-semibold">
              <ShieldAlert className="size-3.5" aria-hidden="true" /> Awaiting approval
            </span>
          )}
        </div>

        {isWaiting && (
          <div className="flex items-center gap-1.5">
            <LinearButton
              variant="secondary"
              size="sm"
              onClick={() => onReject(step.step_index)}
              disabled={executing}
            >
              Reject
            </LinearButton>
            <LinearButton
              variant="primary"
              size="sm"
              onClick={() => onApprove(step.step_index)}
              disabled={executing}
            >
              <Sparkles className="size-3" aria-hidden="true" />
              <span>Approve</span>
            </LinearButton>
          </div>
        )}
      </div>
    </LinearCard>
  );
}
