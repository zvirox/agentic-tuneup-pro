import React, { useEffect } from "react";
import { X, FileCode, HardDrive } from "lucide-react";
import { LinearCard } from "./linear/LinearCard";
import { LinearButton } from "./linear/LinearButton";
import { RuleScanResult } from "../types";

interface SamplePathsModalProps {
  rule: RuleScanResult | null;
  onClose: () => void;
}

export const SamplePathsModal: React.FC<SamplePathsModalProps> = ({ rule, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!rule) return null;

  const paths = rule.sample_paths.length > 0 ? rule.sample_paths : rule.matched_paths;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Sample paths for ${rule.name}`}
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <LinearCard
        level="modal"
        className="p-5 max-w-2xl w-full flex flex-col gap-4 max-h-[80vh]"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-muted flex items-center justify-center text-accent">
              <HardDrive size={16} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">{rule.name}</h3>
              <p className="text-xs text-text-secondary">
                Rule ID: <span className="font-mono text-accent">{rule.rule_id}</span> · Showing up
                to {paths.length} sample target paths
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Path List */}
        <div className="overflow-y-auto flex flex-col gap-2 p-1">
          {paths.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-secondary">
              No matching files currently present on disk.
            </div>
          ) : (
            paths.map((path, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-border-subtle text-xs font-mono break-all hover:bg-white/10 transition-colors"
              >
                <FileCode size={13} className="text-accent shrink-0" />
                <span className="text-text-primary select-all text-[11px]">{String(path)}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs text-text-secondary">
          <span>Protected credential paths are automatically excluded.</span>
          <LinearButton
            variant="primary"
            size="sm"
            onClick={onClose}
          >
            Done
          </LinearButton>
        </div>
      </LinearCard>
    </div>
  );
};
