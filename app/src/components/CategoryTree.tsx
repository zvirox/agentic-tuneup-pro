import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  AlertCircle,
} from "lucide-react";
import { CategoryScanResult, RuleScanResult, ScanSummary } from "../types";

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

  return (
    <div className="flex flex-col gap-4">
      {/* Running Application Lock Alert */}
      {uniqueBlockingApps.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 rounded-2xl bg-signal-thinking-bg border border-signal-thinking/30 flex items-start gap-3.5 text-signal-thinking animate-in fade-in"
        >
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-medium block text-sm">
              Applications In Use ({uniqueBlockingApps.join(", ")})
            </span>
            <span>
              These applications are currently running. To protect active browser tabs and
              database locks, rules requiring these apps will be skipped or blocked until the
              application is closed.
            </span>
          </div>
        </div>
      )}

      {/* Categories Accordion */}
      {summary.categories.map((cat) => {
        const isCollapsed = collapsedCats.has(cat.category_id);
        const ruleIds = cat.rules.map((r) => r.rule_id);
        const checkedCount = ruleIds.filter((id) => selectedRuleIds.has(id)).length;
        const allChecked = checkedCount === ruleIds.length && ruleIds.length > 0;
        const someChecked = checkedCount > 0 && checkedCount < ruleIds.length;

        return (
          <div
            key={cat.category_id}
            className="glass-panel rounded-2xl overflow-hidden transition-colors border border-border-glass"
          >
            {/* Category Header */}
            <div className="flex items-center justify-between p-3.5 bg-white/5 border-b border-border-subtle select-none">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleCollapse(cat.category_id)}
                  aria-label={isCollapsed ? `Expand ${cat.display_name}` : `Collapse ${cat.display_name}`}
                  className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>

                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(input) => {
                    if (input) input.indeterminate = someChecked;
                  }}
                  onChange={() => onToggleCategory(cat)}
                  aria-label={`Select all rules in ${cat.display_name}`}
                  className="w-4 h-4 accent-accent rounded cursor-pointer"
                />

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{cat.display_name}</span>
                  <span className="text-[10px] font-mono text-text-secondary bg-white/10 px-1.5 py-0.5 rounded">
                    {checkedCount} / {cat.rules.length} selected
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="font-medium text-accent">{formatBytes(cat.reclaimable_bytes)}</span>
                <span className="text-text-secondary">· {cat.file_count} files</span>
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
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors border ${
                        isChecked
                          ? "bg-white/5 border-border-glass"
                          : "bg-transparent border-transparent opacity-60"
                      } ${isBlocked ? "border-signal-thinking/40 bg-signal-thinking-bg/20" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleRule(rule.rule_id)}
                          aria-label={`Toggle rule ${rule.name}`}
                          className="w-4 h-4 accent-accent rounded cursor-pointer shrink-0"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-text-primary">
                              {rule.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-text-secondary border border-border-subtle">
                              Tier {rule.risk_tier}
                            </span>

                            {isBlocked && (
                              <span className="text-[10px] font-mono text-signal-thinking bg-signal-thinking-bg px-1.5 py-0.5 rounded font-medium border border-signal-thinking/30">
                                App Running ({rule.running_apps_blocking.join(", ")})
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-text-secondary font-mono truncate block">
                            {rule.rule_id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <button
                          onClick={() => onInspectRule(rule)}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-text-secondary hover:text-text-primary text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                          title="Inspect sample matching paths"
                        >
                          <Eye size={12} />
                          <span>Samples ({rule.sample_paths.length})</span>
                        </button>

                        <div className="text-right font-mono text-xs min-w-[70px]">
                          <span className="font-medium text-text-primary block">
                            {formatBytes(rule.reclaimable_bytes)}
                          </span>
                          <span className="text-[10px] text-text-secondary block">
                            {rule.file_count} files
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
