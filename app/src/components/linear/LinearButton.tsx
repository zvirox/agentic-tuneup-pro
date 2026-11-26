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
      "bg-primary hover:bg-primary-hover text-primary-fg font-medium border border-primary",
    secondary:
      "bg-surface-2 hover:bg-hover text-fg-2 border border-border hover:border-border-strong font-medium",
    ghost:
      "bg-transparent hover:bg-hover text-muted hover:text-fg border border-transparent",
    danger:
      "bg-chip-red hover:bg-red hover:text-white text-red-text border border-red font-medium",
  }[variant];

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-sans transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--primary-text)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
