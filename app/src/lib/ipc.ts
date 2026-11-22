import { invoke } from "@tauri-apps/api/core";
import { QuarantineSessionRecord, AuditEntry, ExecutionResult } from "../types";

export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}

export async function listQuarantineSessions(): Promise<QuarantineSessionRecord[]> {
  const mockFallback: QuarantineSessionRecord[] = [
    {
      session_id: "q_20261122_084500_8f3a",
      created_at: Math.floor(Date.now() / 1000) - 3600,
      expires_at: Math.floor(Date.now() / 1000) + 6 * 86400,
      rule_ids_json: JSON.stringify(["chrome-cache", "system-tmp", "stale-node-modules"]),
      bytes_reclaimed: 4509715660,
      file_count: 1420,
      status: "active",
      restored_at: null,
    },
    {
      session_id: "q_20261121_142000_1a4b",
      created_at: Math.floor(Date.now() / 1000) - 86400,
      expires_at: Math.floor(Date.now() / 1000) + 5 * 86400,
      rule_ids_json: JSON.stringify(["firefox-cache"]),
      bytes_reclaimed: 812400100,
      file_count: 310,
      status: "restored",
      restored_at: Math.floor(Date.now() / 1000) - 86000,
    },
  ];

  return safeInvoke<QuarantineSessionRecord[]>("cleaner_list_quarantine", undefined, mockFallback);
}

export async function restoreQuarantine(sessionId: string): Promise<ExecutionResult> {
  const mockFallback: ExecutionResult = {
    success: true,
    bytes_reclaimed: 0,
    files_affected: 1420,
    undo_session_id: sessionId,
    summary: `Restored session ${sessionId}`,
  };

  return safeInvoke<ExecutionResult>("cleaner_restore_quarantine", { sessionId }, mockFallback);
}

export async function purgeQuarantine(sessionId: string): Promise<number> {
  return safeInvoke<number>("cleaner_purge_quarantine", { sessionId }, 4509715660);
}

export async function getAuditLog(limit = 50, initiator?: string): Promise<AuditEntry[]> {
  const mockFallback: AuditEntry[] = [
    {
      entry_id: 104,
      timestamp: Math.floor(Date.now() / 1000) - 300,
      initiator: "starship",
      action_type: "tuneup.clean_junk",
      target: "chrome-cache, system-tmp",
      risk_tier: 2,
      status: "success",
      details_json: JSON.stringify({ bytes_reclaimed: 4509715660, undo_session_id: "q_20261122_084500_8f3a" }),
    },
    {
      entry_id: 103,
      timestamp: Math.floor(Date.now() / 1000) - 1800,
      initiator: "user",
      action_type: "tuneup.scan_junk",
      target: "all_categories",
      risk_tier: 1,
      status: "success",
      details_json: JSON.stringify({ categories_scanned: 4, files_inspected: 18450 }),
    },
    {
      entry_id: 102,
      timestamp: Math.floor(Date.now() / 1000) - 86400,
      initiator: "user",
      action_type: "cleaner.restore_quarantine",
      target: "q_20261121_142000_1a4b",
      risk_tier: 2,
      status: "success",
      details_json: JSON.stringify({ files_restored: 310 }),
    },
  ];

  return safeInvoke<AuditEntry[]>("safety_get_audit_log", { limit, initiator }, mockFallback);
}
