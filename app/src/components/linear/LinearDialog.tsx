import React, { useEffect } from "react";
import { LinearCard } from "./LinearCard";

export interface LinearDialogProps {
  open: boolean;
  onClose: () => void;
  titleId?: string;
  ariaLabel?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
  className?: string;
}

export const LinearDialog: React.FC<LinearDialogProps> = ({
  open,
  onClose,
  titleId,
  ariaLabel,
  maxWidthClass = "max-w-lg",
  children,
  className = "",
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : ariaLabel}
      onClick={onClose}
      className="fixed inset-0 z-50 linear-scrim flex items-center justify-center p-4"
    >
      <LinearCard
        level="modal"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} ${className}`}
      >
        {children}
      </LinearCard>
    </div>
  );
};
