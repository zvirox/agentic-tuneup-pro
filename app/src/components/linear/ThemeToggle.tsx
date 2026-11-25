import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type LinearTheme = "dark" | "light";

const STORAGE_KEY = "ui-theme";

export function readCurrentTheme(): LinearTheme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function applyTheme(next: LinearTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.classList.toggle("light", next === "light");
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent("theme-changed", { detail: { theme: next } }));
}

export function useLinearTheme(): LinearTheme {
  const [theme, setTheme] = useState<LinearTheme>(() => readCurrentTheme());

  useEffect(() => {
    const sync = () => setTheme(readCurrentTheme());
    const onThemeChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ theme?: LinearTheme }>).detail;
      if (detail?.theme === "light" || detail?.theme === "dark") {
        setTheme(detail.theme);
      } else {
        sync();
      }
    };
    window.addEventListener("theme-changed", onThemeChanged);
    return () => window.removeEventListener("theme-changed", onThemeChanged);
  }, []);

  return theme;
}

export interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
  onToggle?: (theme: LinearTheme) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = "",
  compact = false,
  onToggle,
}) => {
  const theme = useLinearTheme();

  const handleToggle = () => {
    const next: LinearTheme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    onToggle?.(next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={`${
        compact ? "size-6 rounded" : "size-7 rounded-md"
      } inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-colors duration-150 ease-out cursor-pointer ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="size-3.5" aria-hidden="true" />
      ) : (
        <Moon className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
};
