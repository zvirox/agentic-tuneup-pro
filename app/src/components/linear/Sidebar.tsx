import React from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from "lucide-react";

export type SidebarWorkspace = "daily" | "dev" | "server";

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export interface SidebarProps {
  items: SidebarNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  workspace: SidebarWorkspace;
  onSelectWorkspace: (ws: SidebarWorkspace) => void;
  className?: string;
}

const WORKSPACES: { id: SidebarWorkspace; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "dev", label: "Dev" },
  { id: "server", label: "Server" },
];

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeId,
  onSelect,
  collapsed,
  onToggleCollapse,
  workspace,
  onSelectWorkspace,
  className = "",
}) => {
  return (
    <aside
      aria-label="Primary navigation"
      className={`${
        collapsed ? "w-14" : "w-60"
      } shrink-0 border-r border-[var(--border)] bg-[var(--bg-app)] flex flex-col justify-between p-2.5 transition-[width] duration-150 ease-out select-none ${className}`}
    >
      <div className="flex flex-col gap-3">
        {/* Workspace Switcher + Collapse Toggle */}
        <div className="flex items-center justify-between gap-1.5">
          {!collapsed && (
            <div
              role="group"
              aria-label="Workspace profile"
              className="flex-1 grid grid-cols-3 gap-0.5 p-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border)]"
            >
              {WORKSPACES.map((ws) => {
                const isSelected = workspace === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => onSelectWorkspace(ws.id)}
                    aria-pressed={isSelected}
                    className={`h-7 flex items-center justify-center px-1.5 rounded text-xs font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--accent)] cursor-pointer ${
                      isSelected
                        ? "bg-[var(--bg-surface-2)] text-[var(--text)] border border-[var(--border-strong)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent"
                    }`}
                    title={`${ws.label} Workspace`}
                  >
                    <span>{ws.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`${
              collapsed ? "w-full" : "size-8"
            } h-8 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-2)] border border-transparent hover:border-[var(--border)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-colors duration-150 ease-out cursor-pointer`}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Navigation Links (36 px tall) */}
        <nav className="flex flex-col gap-1" aria-label="Main views">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`h-9 w-full flex items-center ${
                  collapsed ? "justify-center px-0" : "justify-between px-2.5"
                } rounded-md text-[13px] font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--accent)] cursor-pointer border ${
                  isActive
                    ? "bg-[var(--bg-surface-2)] text-[var(--text)] border-[var(--border)]"
                    : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface)] border-transparent"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={
                      isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                    }
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!collapsed && item.badge && (
                  <span className="px-1.5 py-0.5 text-[11px] leading-none rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] tabular-nums shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Safety Boundary Indicator */}
      <div
        className={`rounded-lg bg-[var(--tint-green)] border border-[var(--tint-green-border)] text-[var(--color-green)] ${
          collapsed ? "p-2 flex items-center justify-center" : "p-3"
        }`}
        title="Passwords and keyrings are strictly protected and never touched."
      >
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Safety Boundary</span>}
        </div>
        {!collapsed && (
          <p className="text-[11px] leading-relaxed mt-1 text-[var(--color-green)]">
            Passwords &amp; keyrings are strictly protected and never touched.
          </p>
        )}
      </div>
    </aside>
  );
};
