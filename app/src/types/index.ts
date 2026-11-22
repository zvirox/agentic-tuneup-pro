export interface QuarantineSessionRecord {
  session_id: string;
  created_at: number;
  expires_at: number;
  rule_ids_json: string;
  bytes_reclaimed: number;
  file_count: number;
  status: "active" | "restored" | "purged";
  restored_at: number | null;
}

export interface AuditEntry {
  entry_id: number;
  timestamp: number;
  initiator: "user" | "starship" | "agent" | string;
  action_type: string;
  target: string;
  risk_tier: 1 | 2 | 3;
  status: "success" | "failed" | "rolled_back" | string;
  details_json: string;
}

export interface ExecutionResult {
  success: boolean;
  bytes_reclaimed: number;
  files_affected: number;
  undo_session_id?: string;
  summary: string;
}
