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

export interface CpuSnapshot {
  aggregate_usage_percent: number;
  core_count: number;
  core_usages: number[];
  frequency_mhz: number;
  temperature_celsius?: number | null;
}

export interface MemorySnapshot {
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  swap_total_bytes: number;
  swap_used_bytes: number;
}

export interface DiskSnapshot {
  mount_point: string;
  total_bytes: number;
  used_bytes: number;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
}

export interface NetworkSnapshot {
  interface_name: string;
  download_bytes_per_sec: number;
  upload_bytes_per_sec: number;
}

export interface TelemetrySnapshot {
  timestamp: number;
  cpu: CpuSnapshot;
  memory: MemorySnapshot;
  disk: DiskSnapshot;
  network: NetworkSnapshot;
}

export interface HealthDeduction {
  category: string;
  points: number;
  reason: string;
  action_label: string;
  target_page: string;
}

export interface HealthScore {
  score: number;
  rating: "good" | "fair" | "poor" | string;
  deductions: HealthDeduction[];
}
