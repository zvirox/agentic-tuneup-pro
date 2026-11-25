import React, { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import { ThemeToggle, LinearTheme } from "./ThemeToggle";

export interface TitleBarProps {
  title?: string;
  version?: string;
  icon?: React.ReactNode;
  className?: string;
  onThemeToggle?: (theme: LinearTheme) => void;
}

const DEFAULT_VERSION = `v${tauriConfig.version}`;

export const TitleBar: React.FC<TitleBarProps> = ({
  title = tauriConfig.productName || "Agentic Tuneup Pro",
  version = DEFAULT_VERSION,
  icon,
  className = "",
  onThemeToggle,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
      ) {
        const appWindow = getCurrentWindow();
        appWindow.isMaximized().then(setIsMaximized).catch(() => {});
        const unlisten = appWindow.onResized(() => {
          appWindow.isMaximized().then(setIsMaximized).catch(() => {});
        });
        return () => {
          unlisten.then((fn) => fn()).catch(() => {});
        };
      }
    } catch {
      // Running in plain browser preview
    }
  }, []);

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {
      // ignore outside Tauri
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    } catch {
      setIsMaximized((prev) => !prev);
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch {
      // ignore outside Tauri
    }
  };

  return (
    <header
      role="region"
      aria-label="Window Title Bar"
      data-tauri-drag-region
      className={`h-10 w-full select-none bg-[var(--bg-app)] border-b border-[var(--border)] flex items-center justify-between px-3 text-[var(--text)] shrink-0 z-50 ${className}`}
    >
      {/* Left: app logo (20 px), app name, version tag (11 px, 4 px radius, 1 px border) */}
      <div data-tauri-drag-region className="flex items-center gap-2 shrink-0">
        {icon ? (
          <span className="size-5 shrink-0 flex items-center justify-center">{icon}</span>
        ) : (
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="size-5 shrink-0 rounded object-contain"
          />
        )}
        <span className="text-[13px] font-semibold tracking-tight text-[var(--text)]">
          {title}
        </span>
        {version && (
          <span className="px-1.5 py-0.5 text-[11px] leading-none font-normal rounded bg-[var(--bg-surface-2)] border border-[var(--border)] text-[var(--text-muted)] select-none tabular-nums">
            {version}
          </span>
        )}
      </div>

      {/* Center: empty drag region; double-click toggles maximize */}
      <div
        data-tauri-drag-region
        onDoubleClick={handleToggleMaximize}
        className="flex-1 h-full min-w-8 cursor-default"
      />

      {/* Right, in order: theme toggle, divider, minimize, maximize/restore, close */}
      <div className="flex items-center gap-1 shrink-0">
        <ThemeToggle onToggle={onThemeToggle} />

        <div className="w-px h-3.5 bg-[var(--border)] mx-1" aria-hidden="true" />

        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimize window"
          title="Minimize"
          className="size-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-colors duration-150 ease-out cursor-pointer"
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          title={isMaximized ? "Restore" : "Maximize"}
          className="size-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-colors duration-150 ease-out cursor-pointer"
        >
          {isMaximized ? (
            <Copy className="size-3" aria-hidden="true" />
          ) : (
            <Square className="size-3" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Close window"
          title="Close"
          className="size-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--close-hover)] hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-colors duration-150 ease-out cursor-pointer"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
