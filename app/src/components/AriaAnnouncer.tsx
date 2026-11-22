import React from "react";

interface AriaAnnouncerProps {
  message: string | null;
}

/**
 * Screen Reader Accessible Live Region Announcer (WCAG AA).
 * Politely notifies assistive technologies of state mutations,
 * background scans, and safety operations without visual clutter.
 */
export const AriaAnnouncer: React.FC<AriaAnnouncerProps> = ({ message }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message ?? ""}
    </div>
  );
};
