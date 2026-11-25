import React from "react";

export interface LinearButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const LinearButton: React.FC<LinearButtonProps> = ({
  variant = "secondary",
  size = "md",
  type = "button",
  className = "",
  children,
  ...props
}) => {
  const sizeStyles = {
    sm: "h-7 px-2.5 text-xs",
    md: "h-8 px-3 text-[13px]",
    lg: "h-10 px-4 text-sm",
  }[size];

  const variantStyles = {
    primary:
      "bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] text-[var(--accent-fg)] font-medium border border-[var(--accent)]",
    secondary:
      "bg-[var(--bg-surface-2)] hover:bg-[var(--bg-bar-idle)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] font-medium",
    ghost:
      "bg-transparent hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent",
    danger:
      "bg-[var(--tint-red)] hover:bg-[var(--tint-red-hover)] text-[var(--color-red)] border border-[var(--tint-red-border)] font-medium",
  }[variant];

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-sans transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
