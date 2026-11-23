import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  LayoutDashboard,
  Trash2,
  Package,
  Cpu,
  Sliders,
  Sparkles,
  RotateCcw,
  Zap,
  Bot,
  Camera,
  Layers,
  Mic,
  CornerDownLeft,
  X,
} from "lucide-react";
import { Page } from "../types";

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
  onToggleReduceEffects: () => void;
  reduceEffects: boolean;
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
  onToggleReduceEffects,
  reduceEffects,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Command Definitions
  const commands: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: "nav-dashboard",
        title: "Go to Dashboard",
        description: "View real-time hardware telemetry and system health score",
        category: "Navigation",
        icon: LayoutDashboard,
        shortcut: "1",
        action: () => onNavigate("dash"),
      },
      {
        id: "nav-cleaner",
        title: "Go to System Cleaner",
        description: "Review reclaimable application caches, logs, and dev artifacts",
        category: "Navigation",
        icon: Trash2,
        shortcut: "2",
        action: () => onNavigate("clean"),
      },
      {
        id: "nav-apps",
        title: "Go to Application Manager",
        description: "Inspect Flatpaks, native packages, and find orphan dependencies",
        category: "Navigation",
        icon: Package,
        shortcut: "3",
        action: () => onNavigate("apps"),
      },
      {
        id: "nav-processes",
        title: "Go to Process Explorer",
        description: "Investigate process trees, CPU/RAM hogs, and systemd units",
        category: "Navigation",
        icon: Cpu,
        shortcut: "4",
        action: () => onNavigate("proc"),
      },
      {
        id: "nav-settings",
        title: "Go to Settings & Audit",
        description: "Review immutable SQLite audit logs and system bridge settings",
        category: "Navigation",
        icon: Sliders,
        shortcut: "5",
        action: () => onNavigate("set"),
      },

      // Actions
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
        description: "Instantly restore quarantined files with byte-level SHA-256 parity",
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

      // Diagnostics & AI
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
        description: "Open the sovereign AI cockpit and autonomous task planner",
        category: "Diagnostics",
        icon: Bot,
        shortcut: "Ctrl+Shift+A",
        action: () => onToggleAgent(),
      },
      {
        id: "ai-voice-dictation",
        title: "Voice Dictation / Push-to-Talk",
        description: "Capture voice instruction with local offline Whisper STT",
        category: "Diagnostics",
        icon: Mic,
        shortcut: "Ctrl+Space",
        action: () => {
          onToggleAgent();
        },
      },

      // System & Preferences
      {
        id: "pref-reduce-effects",
        title: reduceEffects ? "Disable Reduce Effects (Glass Blur ON)" : "Enable Reduce Effects (Solid Obsidian)",
        description: "Optimize rendering performance for low-end GPUs or remote X11",
        category: "System",
        icon: Layers,
        badge: reduceEffects ? "Solid" : "Glass",
        action: () => onToggleReduceEffects(),
      },
    ],
    [
      onNavigate,
      onTriggerScan,
      onTriggerUndo,
      onOpenDiagnostics,
      onToggleAgent,
      onCreateSnapshot,
      onToggleReduceEffects,
      reduceEffects,
    ]
  );

  // Filter commands by search query
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

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus management on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeItem = listRef.current.children[selectedIndex] as HTMLElement;
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Keyboard navigation within palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Universal Command Palette"
    >
      <div
        className="w-full max-w-xl rounded-2xl glass-panel-strong border border-border-glass shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle bg-canvas/40">
          <Search size={18} className="text-accent shrink-0" />
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
            className="w-full bg-transparent border-0 outline-none text-sm text-text-primary placeholder:text-text-disabled"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-text-muted hover:text-text-primary p-1 rounded-md"
              aria-label="Clear search input"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="font-mono text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-text-muted">
            ESC to close
          </kbd>
        </div>

        {/* Command List */}
        <ul
          id="command-listbox"
          ref={listRef}
          role="listbox"
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y-0"
        >
          {filteredCommands.length === 0 ? (
            <li className="py-12 text-center text-xs text-text-muted">
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
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-accent/15 border border-accent/40 text-text-primary"
                      : "hover:bg-white/5 text-text-secondary border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? "bg-accent text-accent-text"
                          : "bg-surface-glass border border-border-subtle text-accent"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary truncate">
                          {cmd.title}
                        </span>
                        {cmd.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-text-secondary border border-white/10">
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-disabled truncate">
                        {cmd.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {cmd.shortcut && (
                      <kbd className="font-mono text-[10px] bg-black/40 border border-border-subtle px-1.5 py-0.5 rounded text-text-muted">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft size={13} className="text-accent" />
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-border-subtle bg-canvas/60 flex items-center justify-between text-[11px] text-text-disabled">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono text-[10px] bg-white/5 border border-white/10 px-1 rounded">↑</kbd>
              <kbd className="font-mono text-[10px] bg-white/5 border border-white/10 px-1 rounded">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono text-[10px] bg-white/5 border border-white/10 px-1 rounded">↵</kbd>
              <span>select</span>
            </span>
          </div>
          <span className="font-mono text-[10px] text-accent">
            Mother Ship · Starship Ecosystem
          </span>
        </div>
      </div>
    </div>
  );
};
