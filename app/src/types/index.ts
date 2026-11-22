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

export interface RuleScanResult {
  rule_id: string;
  name: string;
  category: string;
  risk_tier: number;
  reclaimable_bytes: number;
  file_count: number;
  sample_paths: string[];
  matched_paths: string[];
  running_apps_blocking: string[];
}

export interface CategoryScanResult {
  category_id: string;
  display_name: string;
  reclaimable_bytes: number;
  file_count: number;
  rules: RuleScanResult[];
}

export interface ScanSummary {
  total_reclaimable_bytes: number;
  total_file_count: number;
  categories: CategoryScanResult[];
  blocked_by_running_apps: boolean;
}

export interface CleanExecutionOutput {
  session_id: string;
  bytes_freed: number;
  files_count: number;
  quarantine_path: string;
}

export interface PackageInfo {
  id: string;
  name: string;
  version: string;
  backend: "flatpak" | "pacman" | "apt" | "dnf" | "appimage" | string;
  summary: string;
  size_bytes?: number | null;
  is_updatable: boolean;
}

export interface PackageUpdate {
  package_id: string;
  current_version: string;
  new_version: string;
  backend: string;
  download_size_bytes?: number | null;
}

export interface PackagePlan {
  plan_id: string;
  action_type: "install" | "remove" | "purge_orphans" | string;
  risk_tier: number;
  target_package: string;
  affected_packages: string[];
  download_bytes: number;
  disk_delta_bytes: number;
  requires_polkit: boolean;
}

export interface ProcessEntry {
  pid: number;
  ppid?: number | null;
  name: string;
  displayName: string;
  cpuPercent: number;
  memoryBytes: number;
  ioReadBytesPerSec: number;
  isCritical: boolean;
}

export interface AppProcessGroup {
  groupId: string;
  appName: string;
  rootPid: number;
  processCount: number;
  totalCpuPercent: number;
  totalMemoryBytes: number;
  pids: number[];
  isCritical: boolean;
}

export interface ServiceEntry {
  unitName: string;
  description: string;
  loadState: string;
  activeState: string;
  subState: string;
  isUserUnit: boolean;
}

export interface AutostartEntry {
  fileName: string;
  name: string;
  comment?: string | null;
  exec: string;
  enabled: boolean;
  path: string;
}

// ================= Agent Cockpit Types =================

export type StepExecutionStatus =
  | "pending"
  | "waiting_approval"
  | "executing"
  | "completed"
  | "failed"
  | "rejected";

export interface PlanStep {
  step_id: string;
  step_index: number;
  tool_name: string;
  risk_tier: 1 | 2 | 3;
  description: string;
  arguments: Record<string, unknown>;
  status: StepExecutionStatus;
  diff_summary?: string | null;
}

export interface TaskPlan {
  plan_id: string;
  user_intent: string;
  steps: PlanStep[];
  total_disk_delta_bytes: number;
}

export type LlmProviderType = "sovereign_offline" | "ollama" | "claude" | "openai";

export interface AgentConfig {
  provider: LlmProviderType;
  endpoint?: string | null;
  model: string;
  apiKey?: string | null;
}
