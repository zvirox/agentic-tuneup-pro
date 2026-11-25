import React, { forwardRef } from "react";

export interface LinearCardProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3 | "pane" | "raised" | "modal" | "overlay";
}

export const LinearCard = forwardRef<HTMLDivElement, LinearCardProps>(
  ({ level = 1, className = "", children, ...props }, ref) => {
    const normalizedLevel: 1 | 2 | 3 =
      typeof level === "number"
        ? level
        : level === "raised"
        ? 2
        : level === "modal" || level === "overlay"
        ? 3
        : 1;

    const levelStyles = {
      1: "bg-[var(--bg-surface)] border-[var(--border)] linear-card",
      2: "bg-[var(--bg-surface)] border-[var(--border)] linear-card",
      3: "bg-[var(--bg-surface)] border-[var(--border-strong)] linear-card",
    }[normalizedLevel];

    return (
      <div
        ref={ref}
        className={`rounded-lg border transition-colors duration-150 ease-out text-[var(--text)] ${levelStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

LinearCard.displayName = "LinearCard";
