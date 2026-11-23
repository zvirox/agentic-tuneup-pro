import React, { useState } from "react";
import { Undo2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { restoreQuarantine } from "../lib/ipc";
import { ExecutionResult } from "../types";

interface UndoButtonProps {
  sessionId: string;
  bytesCount?: number;
  filesCount?: number;
  onRestored?: (result: ExecutionResult) => void;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const UndoButton: React.FC<UndoButtonProps> = ({
  sessionId,
  bytesCount,
  filesCount,
  onRestored,
  className = "",
}) => {
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRestore = async () => {
    if (loading || restored) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const result = await restoreQuarantine(sessionId);
      setRestored(true);
      if (onRestored) {
        onRestored(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  if (restored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-signal-success-bg border border-signal-success/30 text-signal-success text-xs font-semibold ${className}`}
      >
        <CheckCircle2 size={14} className="shrink-0" />
        <span>Restored successfully</span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={handleRestore}
        disabled={loading}
        aria-label={`Undo and restore quarantine session ${sessionId}`}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover active:bg-accent-active disabled:opacity-50 text-accent-text text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas ${className}`}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin shrink-0" />
        ) : (
          <Undo2 size={14} className="shrink-0" />
        )}
        <span>
          {loading
            ? "Restoring..."
            : bytesCount !== undefined
            ? `Undo (${formatBytes(bytesCount)})`
            : "Instant Undo"}
        </span>
        {filesCount !== undefined && !loading && (
          <span className="font-mono text-[10px] opacity-75">· {filesCount} files</span>
        )}
      </button>

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-1 text-[11px] text-signal-gate font-medium"
        >
          <AlertCircle size={12} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
