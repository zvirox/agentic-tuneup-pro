import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { restoreQuarantine } from "../lib/ipc";
import { ExecutionResult } from "../types";
import { LinearButton } from "./linear";

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
      onRestored?.(result);
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
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-chip-sky border border-border text-sky-text text-xs font-medium ${className}`}
      >
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Restored successfully</span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <LinearButton
        variant="primary"
        size="sm"
        onClick={handleRestore}
        disabled={loading}
        aria-label={`Undo and restore quarantine session ${sessionId}`}
        className={className}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          <Undo2 className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span>
          {loading
            ? "Restoring..."
            : bytesCount !== undefined
            ? `Undo (${formatBytes(bytesCount)})`
            : "Instant Undo"}
        </span>
        {filesCount !== undefined && !loading && (
          <span className="text-[11px] opacity-80 tabular-nums">· {filesCount} files</span>
        )}
      </LinearButton>

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-1 text-xs text-red-text font-medium"
        >
          <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
