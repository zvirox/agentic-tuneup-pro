import React from "react";
import { Bot, ChevronRight, Search } from "lucide-react";
import { StatusPill } from "./StatusPill";

export interface BreadcrumbProps {
  workspaceLabel: string;
  sectionLabel: string;
  agentOpen: boolean;
  onToggleAgent: () => void;
  onOpenSearch: () => void;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  workspaceLabel,
  sectionLabel,
  agentOpen,
  onToggleAgent,
  onOpenSearch,
  className = "",
}) => {
  return (
    <div
      className={`h-11 shrink-0 border-b border-[var(--border)] bg-[var(--bg-surface)] px-5 flex items-center justify-between gap-4 select-none ${className}`}
    >
      {/* Left: Breadcrumb Trail */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
        <span className="text-[var(--text-muted)] font-medium truncate">
          {workspaceLabel}
        </span>
        <ChevronRight className="size-3.5 text-[var(--text-faint)] shrink-0" aria-hidden="true" />
        <span className="text-[var(--text)] font-semibold truncate">{sectionLabel}</span>
      </nav>

      {/* Right: Socket Status + Search Trigger + Agent Drawer Toggle */}
      <div className="flex items-center gap-2.5 shrink-0">
        <StatusPill
          label="Bridge"
          status="online"
          monoValue="atp.sock"
          className="hidden lg:inline-flex"
        />

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open command palette (Ctrl+K)"
          className={`h-8 flex items-center gap-2 bg-[var(--bg-surface-2)] hover:bg-[var(--bg-bar-idle)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-md px-2.5 ${
            agentOpen ? "w-40" : "w-52"
          } text-xs text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-colors duration-150 ease-out cursor-pointer text-left`}
        >
          <Search className="size-3.5 text-[var(--accent)] shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">Search commands</span>
          <kbd className="text-[11px] border border-[var(--border)] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-faint)]">
            Ctrl K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onToggleAgent}
          aria-expanded={agentOpen}
          title="Toggle Starship Agent (Ctrl+Shift+A)"
          className={`h-8 flex items-center gap-2 px-3 rounded-md border text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-colors duration-150 ease-out cursor-pointer ${
            agentOpen
              ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
              : "bg-[var(--bg-surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]"
          }`}
        >
          <Bot className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Agent</span>
          <kbd
            className={`hidden sm:inline-block text-[11px] px-1 py-0.5 rounded border ${
              agentOpen
                ? "border-[var(--tint-blue-border)] bg-[var(--accent-hover)] text-[var(--accent-fg)]"
                : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)]"
            }`}
          >
            ⌃⇧A
          </kbd>
        </button>
      </div>
    </div>
  );
};
