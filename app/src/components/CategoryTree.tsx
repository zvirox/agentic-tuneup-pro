import React, { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { CategoryScanResult, RuleScanResult, ScanSummary } from "../types";
import { LinearButton, LinearCard, ProgressRow } from "./linear";

interface CategoryTreeProps {
  summary: ScanSummary;
  selectedRuleIds: Set<string>;
  onToggleRule: (ruleId: string) => void;
  onToggleCategory: (category: CategoryScanResult) => void;
  onInspectRule: (rule: RuleScanResult) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  summary,
  selectedRuleIds,
  onToggleRule,
  onToggleCategory,
  onInspectRule,
}) => {
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const toggleCollapse = (catId: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const allBlockingApps: string[] = [];
  for (const cat of summary.categories) {
    for (const r of cat.rules) {
      if (r.running_apps_blocking.length > 0) {
        allBlockingApps.push(...r.running_apps_blocking);
      }
    }
  }
  const uniqueBlockingApps = Array.from(new Set(allBlockingApps));
  const totalBytes = Math.max(summary.total_reclaimable_bytes, 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Running Application Lock Alert */}
      {uniqueBlockingApps.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 rounded-lg bg-surface-2 border border-amber flex items-start gap-3 text-amber"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold block text-[13px] text-fg">
              Applications In Use ({uniqueBlockingApps.join(", ")})
            </span>
            <span className="text-muted">
              These applications are currently running. To protect active browser tabs and
              database locks, rules requiring these apps will be skipped until the
              application is closed.
            </span>
          </div>
        </div>
      )}

      {/* Cleanable Breakdown Summary Progress Card */}
      <LinearCard level={1} className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Cleanable Disk Distribution
          </span>
          <span className="text-xs font-medium text-fg tabular-nums">
            {formatBytes(summary.total_reclaimable_bytes)} · {summary.total_file_count} files
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.categories.map((cat, idx) => (
            <ProgressRow
              key={cat.category_id}
              label={cat.display_name}
              value={(cat.reclaimable_bytes / totalBytes) * 100}
              displayValue={formatBytes(cat.reclaimable_bytes)}
              color={
                idx % 4 === 0
                  ? "var(--primary)"
                  : idx % 4 === 1
                  ? "var(--sky)"
                  : idx % 4 === 2
                  ? "var(--amber)"
                  : "var(--purple)"
              }
            />
          ))}
        </div>
      </LinearCard>

      {/* Categories Accordion */}
      {summary.categories.map((cat) => {
        const isCollapsed = collapsedCats.has(cat.category_id);
        const ruleIds = cat.rules.map((r) => r.rule_id);
        const checkedCount = ruleIds.filter((id) => selectedRuleIds.has(id)).length;
        const allChecked = checkedCount === ruleIds.length && ruleIds.length > 0;
        const someChecked = checkedCount > 0 && checkedCount < ruleIds.length;

        return (
          <LinearCard key={cat.category_id} level={1} className="overflow-hidden">
            {/* Category Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border select-none">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleCollapse(cat.category_id)}
                  aria-label={
                    isCollapsed ? `Expand ${cat.display_name}` : `Collapse ${cat.display_name}`
                  }
                  className="p-1 rounded text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-[var(--primary-text)] transition-colors duration-150 cursor-pointer"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden="true" />
                  )}
                </button>

                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(input) => {
                    if (input) input.indeterminate = someChecked;
                  }}
                  onChange={() => onToggleCategory(cat)}
                  aria-label={`Select all rules in ${cat.display_name}`}
                  className="size-4 accent-[var(--primary)] rounded cursor-pointer"
                />

                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-semibold text-fg truncate">
                    {cat.display_name}
                  </span>
                  <span className="text-[11px] text-muted bg-surface px-1.5 py-0.5 rounded border border-border tabular-nums">
                    {checkedCount} / {cat.rules.length} selected
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs tabular-nums shrink-0">
                <span className="font-semibold text-primary-text">
                  {formatBytes(cat.reclaimable_bytes)}
                </span>
                <span className="text-muted">· {cat.file_count} files</span>
              </div>
            </div>

            {/* Rules List */}
            {!isCollapsed && (
              <div className="p-3 flex flex-col gap-2">
                {cat.rules.map((rule) => {
                  const isChecked = selectedRuleIds.has(rule.rule_id);
                  const isBlocked = rule.running_apps_blocking.length > 0;

                  return (
                    <div
                      key={rule.rule_id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-md border transition-colors duration-150 ${
                        isBlocked
                          ? "bg-surface-2 border-amber"
                          : isChecked
                          ? "bg-surface-2 border-border"
                          : "bg-surface border-transparent opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleRule(rule.rule_id)}
                          aria-label={`Toggle rule ${rule.name}`}
                          className="size-4 accent-[var(--primary)] rounded cursor-pointer shrink-0"
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-medium text-fg">
                              {rule.name}
                            </span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface text-muted border border-border tabular-nums">
                              Tier {rule.risk_tier}
                            </span>

                            {isBlocked && (
                              <span className="text-[11px] text-amber bg-surface px-1.5 py-0.5 rounded font-medium border border-amber">
                                App Running ({rule.running_apps_blocking.join(", ")})
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[var(--text-faint)] font-mono truncate block mt-0.5">
                            {rule.rule_id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <LinearButton
                          variant="secondary"
                          size="sm"
                          onClick={() => onInspectRule(rule)}
                          title="Inspect sample matching paths"
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          <span>Samples ({rule.sample_paths.length})</span>
                        </LinearButton>

                        <div className="text-right text-xs min-w-[76px] tabular-nums">
                          <span className="font-semibold text-[var(--text)] block">
                            {formatBytes(rule.reclaimable_bytes)}
                          </span>
                          <span className="text-[var(--text-muted)] block">
                            {rule.file_count} files
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </LinearCard>
        );
      })}
    </div>
  );
};
