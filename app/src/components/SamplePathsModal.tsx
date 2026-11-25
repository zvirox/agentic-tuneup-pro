import React from "react";
import { FileCode, HardDrive, X } from "lucide-react";
import { LinearButton, LinearDialog } from "./linear";
import { RuleScanResult } from "../types";

interface SamplePathsModalProps {
  rule: RuleScanResult | null;
  onClose: () => void;
}

export const SamplePathsModal: React.FC<SamplePathsModalProps> = ({ rule, onClose }) => {
  if (!rule) return null;

  const paths = rule.sample_paths.length > 0 ? rule.sample_paths : rule.matched_paths;

  return (
    <LinearDialog
      open={Boolean(rule)}
      onClose={onClose}
      ariaLabel={`Sample paths for ${rule.name}`}
      maxWidthClass="max-w-2xl"
      className="p-5 flex flex-col gap-4 max-h-[80vh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-md bg-[var(--tint-blue)] text-[var(--color-blue)] flex items-center justify-center shrink-0">
            <HardDrive className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text)] truncate">{rule.name}</h3>
            <p className="text-xs text-[var(--text-muted)] truncate">
              Rule: <span className="font-mono text-[var(--accent)]">{rule.rule_id}</span> · Showing up to{" "}
              {paths.length} target paths
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="size-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-colors duration-150 cursor-pointer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Path List */}
      <div className="overflow-y-auto flex flex-col gap-1.5">
        {paths.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)]">
            No matching files currently present on disk.
          </div>
        ) : (
          paths.map((path, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-[var(--bg-surface-2)] border border-[var(--border)] text-xs font-mono break-all"
            >
              <FileCode className="size-3.5 text-[var(--accent)] shrink-0" aria-hidden="true" />
              <span className="text-[var(--text)] select-all">{String(path)}</span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
        <span>Protected credential paths are automatically excluded.</span>
        <LinearButton variant="primary" size="sm" onClick={onClose}>
          Done
        </LinearButton>
      </div>
    </LinearDialog>
  );
};
