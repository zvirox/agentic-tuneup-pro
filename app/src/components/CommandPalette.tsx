import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Camera,
  CornerDownLeft,
  Cpu,
  LayoutDashboard,
  Mic,
  Package,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Page } from "../types";
import { LinearDialog } from "./linear";

export interface CommandItem {
  id: string;
  title: string;
  description: string;
  category: "Navigation" | "Actions" | "Diagnostics" | "System";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  shortcut?: string;
  badge?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
  onTriggerScan: () => void;
  onTriggerUndo: () => void;
  onOpenDiagnostics: () => void;
  onToggleAgent: () => void;
  onCreateSnapshot: () => void;
  onToggleTheme: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onTriggerScan,
  onTriggerUndo,
  onOpenDiagnostics,
  onToggleAgent,
  onCreateSnapshot,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "nav-dashboard",
        title: "Go to Dashboard",
        description: "View real-time hardware telemetry and system health score",
        category: "Navigation",
        icon: LayoutDashboard,
        shortcut: "Alt+1",
        action: () => onNavigate("dash"),
      },
      {
        id: "nav-cleaner",
        title: "Go to System Cleaner",
        description: "Review reclaimable application caches, logs, and dev artifacts",
        category: "Navigation",
        icon: Trash2,
        shortcut: "Alt+2",
        action: () => onNavigate("clean"),
      },
      {
        id: "nav-apps",
        title: "Go to Application Manager",
        description: "Inspect Flatpaks, native packages, and orphan dependencies",
        category: "Navigation",
        icon: Package,
        shortcut: "Alt+3",
        action: () => onNavigate("apps"),
      },
      {
        id: "nav-processes",
        title: "Go to Process Explorer",
        description: "Investigate process trees, CPU/RAM hogs, and systemd units",
        category: "Navigation",
        icon: Cpu,
        shortcut: "Alt+4",
        action: () => onNavigate("proc"),
      },
      {
        id: "nav-settings",
        title: "Go to Settings & Audit",
        description: "Review SQLite audit logs and Starship bridge settings",
        category: "Navigation",
        icon: Sliders,
        shortcut: "Alt+5",
        action: () => onNavigate("set"),
      },
      {
        id: "action-scan",
        title: "Smart Scan & Clean",
        description: "Trigger non-destructive cache and artifact scan across system",
        category: "Actions",
        icon: Sparkles,
        badge: "Cleaner",
        action: () => {
          onNavigate("clean");
          onTriggerScan();
        },
      },
      {
        id: "action-undo",
        title: "Quarantine Vault & Undo",
        description: "Restore quarantined files with byte-level SHA-256 parity",
        category: "Actions",
        icon: RotateCcw,
        badge: "Safety",
        action: () => {
          onNavigate("clean");
          onTriggerUndo();
        },
      },
      {
        id: "action-snapshot",
        title: "Create Pre-Change Snapshot",
        description: "Execute Timeshift, Snapper, or btrfs root snapshot immediately",
        category: "Actions",
        icon: Camera,
        badge: "Safety",
        action: () => onCreateSnapshot(),
      },
      {
        id: "diag-pc-slow",
        title: "Why is my PC slow?",
        description: "Run diagnostic correlation engine across CPU, RAM, thermals & logs",
        category: "Diagnostics",
        icon: Zap,
        badge: "Advisor",
        action: () => onOpenDiagnostics(),
      },
      {
        id: "ai-toggle-agent",
        title: "Toggle Starship Agent Drawer",
        description: "Open the AI cockpit and task planner drawer",
        category: "Diagnostics",
        icon: Bot,
        shortcut: "Ctrl+Shift+A",
        action: () => onToggleAgent(),
      },
      {
        id: "ai-voice-dictation",
        title: "Voice Dictation Preview",
        description: "Open simulated voice dictation controls inside agent drawer",
        category: "Diagnostics",
        icon: Mic,
        shortcut: "Ctrl+Space",
        action: () => onToggleAgent(),
      },
      {
        id: "pref-toggle-theme",
        title: "Toggle Dark / Light Theme",
        description: "Switch between solid Linear Dark and Linear Light palettes",
        category: "System",
        icon: Sun,
        badge: "Theme",
        action: () => onToggleTheme(),
      },
    ],
    [
      onNavigate,
      onTriggerScan,
      onTriggerUndo,
      onOpenDiagnostics,
      onToggleAgent,
      onCreateSnapshot,
      onToggleTheme,
    ]
  );

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [query, commands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!listRef.current) return;
    const activeItem = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length)
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        selected.action();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <LinearDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel="Universal Command Palette"
      maxWidthClass="max-w-xl"
      className="overflow-hidden flex flex-col max-h-[75vh] p-0"
    >
      {/* Search Input Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-2">
        <Search className="size-4 text-primary-text shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-listbox"
          aria-activedescendant={filteredCommands[selectedIndex]?.id}
          placeholder="Search commands"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent border-0 outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded cursor-pointer"
            aria-label="Clear search input"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
        <kbd className="font-mono text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-0.5 rounded text-[var(--text-muted)] shrink-0">
          ESC
        </kbd>
      </div>

      {/* Command List */}
      <ul
        id="command-listbox"
        ref={listRef}
        role="listbox"
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {filteredCommands.length === 0 ? (
          <li className="py-12 text-center text-xs text-[var(--text-muted)]">
            No matching commands found for &ldquo;{query}&rdquo;
          </li>
        ) : (
          filteredCommands.map((cmd, index) => {
            const Icon = cmd.icon;
            const isSelected = index === selectedIndex;
            return (
              <li
                key={cmd.id}
                id={cmd.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors duration-150 cursor-pointer border ${
                  isSelected
                    ? "bg-primary-tint border-primary text-fg"
                    : "hover:bg-hover text-muted border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-1.5 rounded-md shrink-0 ${
                      isSelected
                        ? "bg-primary text-primary-fg"
                        : "bg-surface-2 border border-border text-primary-text"
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-fg truncate">
                        {cmd.title}
                      </span>
                      {cmd.badge && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-2 text-muted border border-border leading-none">
                          {cmd.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">
                      {cmd.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {cmd.shortcut && (
                    <kbd className="font-mono text-[11px] bg-surface-2 border border-border px-1.5 py-0.5 rounded text-muted">
                      {cmd.shortcut}
                    </kbd>
                  )}
                  {isSelected && (
                    <CornerDownLeft className="size-3.5 text-primary-text" aria-hidden="true" />
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      {/* Footer Hints */}
      <div className="px-4 py-2 border-t border-border bg-surface-2 flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="font-mono text-[11px] bg-surface border border-border px-1 rounded">
              ↑
            </kbd>
            <kbd className="font-mono text-[11px] bg-surface border border-border px-1 rounded">
              ↓
            </kbd>
            <span>navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono text-[11px] bg-surface border border-border px-1 rounded">
              ↵
            </kbd>
            <span>select</span>
          </span>
        </div>
        <span className="text-primary-text font-medium">Mother Ship · Starship Bridge</span>
      </div>
    </LinearDialog>
  );
};
