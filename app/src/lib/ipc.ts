import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  QuarantineSessionRecord,
  AuditEntry,
  ExecutionResult,
  TelemetrySnapshot,
  HealthScore,
  ScanSummary,
  CleanExecutionOutput,
  PackageInfo,
  PackageUpdate,
  PackagePlan,
  ProcessEntry,
  AppProcessGroup,
  ServiceEntry,
  AutostartEntry,
  TaskPlan,
  AgentConfig,
} from "../types";

export async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  fallback?: T
): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    // Mock data is only for plain-browser UI development. Inside the real Tauri app
    // a failed command must surface as an error, never as fabricated success.
    const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!inTauri && fallback !== undefined) {
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

export function createMockTelemetrySnapshot(): TelemetrySnapshot {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    cpu: {
      aggregate_usage_percent: 24.2,
      core_count: 8,
      core_usages: [28.1, 22.0, 31.4, 19.8, 25.0, 21.2, 23.5, 22.6],
      frequency_mhz: 3400,
      temperature_celsius: 48.0,
    },
    memory: {
      total_bytes: 17179869184,
      used_bytes: 6657199308,
      available_bytes: 10522669876,
      swap_total_bytes: 8589934592,
      swap_used_bytes: 0,
    },
    disk: {
      mount_point: "/",
      total_bytes: 549755813888,
      used_bytes: 335007446466,
      read_bytes_per_sec: 125829120,
      write_bytes_per_sec: 35651584,
    },
    network: {
      interface_name: "wlp3s0",
      download_bytes_per_sec: 4404019,
      upload_bytes_per_sec: 629145,
    },
  };
}

export async function getTelemetrySnapshot(): Promise<TelemetrySnapshot> {
  return safeInvoke<TelemetrySnapshot>(
    "telemetry_get_snapshot",
    undefined,
    createMockTelemetrySnapshot()
  );
}

export async function getTelemetryHistory(limit = 60): Promise<TelemetrySnapshot[]> {
  const base = createMockTelemetrySnapshot();
  const history: TelemetrySnapshot[] = [];
  for (let i = limit - 1; i >= 0; i--) {
    history.push({
      ...base,
      timestamp: base.timestamp - i,
      cpu: {
        ...base.cpu,
        aggregate_usage_percent: Math.max(10, Math.min(85, 24 + Math.sin(i / 5) * 12)),
      },
    });
  }
  return safeInvoke<TelemetrySnapshot[]>("telemetry_get_history", { limit }, history);
}

export async function getHealthScore(): Promise<HealthScore> {
  const mockHealth: HealthScore = {
    score: 86,
    rating: "good",
    deductions: [
      {
        category: "junk",
        points: 8,
        reason: "4.2 GB of reclaimable junk detected in system and browser caches",
        action_label: "Clean Junk",
        target_page: "clean",
      },
      {
        category: "updates",
        points: 6,
        reason: "12 package updates pending across Flatpak and native",
        action_label: "View Updates",
        target_page: "apps",
      },
    ],
  };

  return safeInvoke<HealthScore>("health_get_score", undefined, mockHealth);
}

export async function subscribeTelemetry(
  callback: (snapshot: TelemetrySnapshot) => void
): Promise<UnlistenFn> {
  try {
    return await listen<TelemetrySnapshot>("evt://telemetry/tick", (event) => {
      callback(event.payload);
    });
  } catch {
    // In browser dev mode, use interval simulation
    const interval = setInterval(() => {
      const snap = createMockTelemetrySnapshot();
      snap.cpu.aggregate_usage_percent = Math.max(
        12,
        Math.min(88, Math.round(24 + (Math.random() - 0.5) * 10))
      );
      callback(snap);
    }, 1000);
    return () => clearInterval(interval);
  }
}

export async function cleanerScan(categories?: string[]): Promise<ScanSummary> {
  const mockFallback: ScanSummary = {
    total_reclaimable_bytes: 4509715660,
    total_file_count: 1420,
    blocked_by_running_apps: false,
    categories: [
      {
        category_id: "browser",
        display_name: "Web Browsers",
        reclaimable_bytes: 1415577600,
        file_count: 890,
        rules: [
          {
            rule_id: "chrome-cache",
            name: "Chrome Cache",
            category: "browser",
            risk_tier: 2,
            reclaimable_bytes: 794820608,
            file_count: 540,
            sample_paths: [
              "/home/user/.cache/google-chrome/Default/Cache/data_0",
              "/home/user/.cache/google-chrome/Default/Cache/data_1",
            ],
            matched_paths: [],
            running_apps_blocking: [],
          },
          {
            rule_id: "firefox-cache",
            name: "Firefox Cache",
            category: "browser",
            risk_tier: 2,
            reclaimable_bytes: 620756992,
            file_count: 350,
            sample_paths: [
              "/home/user/.cache/mozilla/firefox/profile.default/cache2/entries",
            ],
            matched_paths: [],
            running_apps_blocking: [],
          },
        ],
      },
      {
        category_id: "dev",
        display_name: "Development Artifacts",
        reclaimable_bytes: 2314138060,
        file_count: 420,
        rules: [
          {
            rule_id: "stale-node-modules",
            name: "Stale node_modules",
            category: "dev",
            risk_tier: 2,
            reclaimable_bytes: 2254857830,
            file_count: 380,
            sample_paths: [
              "/home/user/Projects/old-web-app/node_modules",
            ],
            matched_paths: [],
            running_apps_blocking: [],
          },
        ],
      },
      {
        category_id: "system",
        display_name: "System Caches & Logs",
        reclaimable_bytes: 780000000,
        file_count: 110,
        rules: [
          {
            rule_id: "system-thumbnails",
            name: "Cached Thumbnails",
            category: "system",
            risk_tier: 2,
            reclaimable_bytes: 780000000,
            file_count: 110,
            sample_paths: [
              "/home/user/.cache/thumbnails/normal/preview.png",
            ],
            matched_paths: [],
            running_apps_blocking: [],
          },
        ],
      },
    ],
  };

  return safeInvoke<ScanSummary>("cleaner_scan", { categories }, mockFallback);
}

export async function cleanerExecuteClean(
  selectedRuleIds: string[]
): Promise<CleanExecutionOutput> {
  const mockFallback: CleanExecutionOutput = {
    session_id: `q_${Math.floor(Date.now() / 1000)}_8f3a`,
    bytes_freed: 4509715660,
    files_count: 1420,
    quarantine_path: "/home/user/.local/share/agentic-tuneup-pro/quarantine/q_mock",
  };

  return safeInvoke<CleanExecutionOutput>(
    "cleaner_execute_clean",
    { selectedRuleIds },
    mockFallback
  );
}

// ================= Package Management IPC =================

export async function pkgListInstalled(backendFilter?: string): Promise<PackageInfo[]> {
  const mockFallback: PackageInfo[] = [
    {
      id: "org.mozilla.firefox",
      name: "Firefox Web Browser",
      version: "133.0",
      backend: "flatpak",
      summary: "Fast, Private & Safe Web Browser",
      size_bytes: 268435456,
      is_updatable: true,
    },
    {
      id: "com.spotify.Client",
      name: "Spotify",
      version: "1.2.50",
      backend: "flatpak",
      summary: "Music and podcast streaming client",
      size_bytes: 188743680,
      is_updatable: false,
    },
    {
      id: "ripgrep",
      name: "ripgrep",
      version: "14.1.0",
      backend: "pacman",
      summary: "Line-oriented search tool combining grep speed with ack usability",
      size_bytes: 5400000,
      is_updatable: false,
    },
    {
      id: "/home/user/Applications/Obsidian-1.7.7.AppImage",
      name: "Obsidian",
      version: "1.7.7",
      backend: "appimage",
      summary: "Standalone Markdown knowledge base & note-taking tool",
      size_bytes: 120586240,
      is_updatable: false,
    },
  ];

  return safeInvoke<PackageInfo[]>("pkg_list_installed", { backendFilter }, mockFallback);
}

export async function pkgCheckUpdates(): Promise<PackageUpdate[]> {
  const mockFallback: PackageUpdate[] = [
    {
      package_id: "org.mozilla.firefox",
      current_version: "133.0",
      new_version: "133.0.1",
      backend: "flatpak",
      download_size_bytes: 94371840,
    },
  ];

  return safeInvoke<PackageUpdate[]>("pkg_check_updates", undefined, mockFallback);
}

export async function pkgAuditOrphans(): Promise<PackageInfo[]> {
  const mockFallback: PackageInfo[] = [
    {
      id: "org.gnome.Platform//44",
      name: "GNOME Platform 44",
      version: "44",
      backend: "flatpak",
      summary: "Unused runtime (no installed applications depend on this)",
      size_bytes: 786432000,
      is_updatable: false,
    },
    {
      id: "libgtk2.0-0",
      name: "libgtk2.0-0",
      version: "2.24.33",
      backend: "apt",
      summary: "Unused library dependency (0 reverse dependencies)",
      size_bytes: 14680064,
      is_updatable: false,
    },
  ];

  return safeInvoke<PackageInfo[]>("pkg_audit_orphans", undefined, mockFallback);
}

export async function pkgPrepareAction(
  actionType: string,
  backendId: string,
  packageId: string
): Promise<PackagePlan> {
  const mockFallback: PackagePlan = {
    plan_id: `pkg_plan_${Math.floor(Date.now() / 1000)}`,
    action_type: actionType,
    risk_tier: actionType === "remove" ? 3 : 2,
    target_package: packageId,
    affected_packages: [packageId],
    download_bytes: 0,
    disk_delta_bytes: -188743680,
    requires_polkit: backendId === "pacman" || backendId === "apt" || backendId === "dnf",
  };

  return safeInvoke<PackagePlan>(
    "pkg_prepare_action",
    { actionType, backendId, packageId },
    mockFallback
  );
}

// ================= Process & Services IPC =================

export async function procList(sortBy = "cpu"): Promise<ProcessEntry[]> {
  const mockFallback: ProcessEntry[] = [
    {
      pid: 3120,
      name: "firefox",
      displayName: "firefox",
      cpuPercent: 12.4,
      memoryBytes: 1824520192,
      ioReadBytesPerSec: 1048576,
      isCritical: false,
    },
    {
      pid: 1450,
      name: "code",
      displayName: "code",
      cpuPercent: 4.8,
      memoryBytes: 1248000000,
      ioReadBytesPerSec: 524288,
      isCritical: false,
    },
    {
      pid: 1,
      name: "systemd",
      displayName: "systemd",
      cpuPercent: 0.1,
      memoryBytes: 18454937,
      ioReadBytesPerSec: 0,
      isCritical: true,
    },
  ];

  return safeInvoke<ProcessEntry[]>("proc_list", { sortBy }, mockFallback);
}

export async function procListGroups(sortBy = "cpu"): Promise<AppProcessGroup[]> {
  const mockFallback: AppProcessGroup[] = [
    {
      groupId: "firefox",
      appName: "Firefox Browser",
      rootPid: 3120,
      processCount: 14,
      totalCpuPercent: 18.2,
      totalMemoryBytes: 2450000000,
      pids: [3120, 3145, 3146, 3150],
      isCritical: false,
    },
    {
      groupId: "code",
      appName: "VS Code",
      rootPid: 1450,
      processCount: 8,
      totalCpuPercent: 5.6,
      totalMemoryBytes: 1850000000,
      pids: [1450, 1460, 1475],
      isCritical: false,
    },
    {
      groupId: "systemd",
      appName: "System Daemons",
      rootPid: 1,
      processCount: 6,
      totalCpuPercent: 0.2,
      totalMemoryBytes: 45000000,
      pids: [1, 240, 350],
      isCritical: true,
    },
  ];

  return safeInvoke<AppProcessGroup[]>("proc_list_groups", { sortBy }, mockFallback);
}

export async function procKill(
  pid: number,
  killTree = true,
  signal = 15
): Promise<number[]> {
  return safeInvoke<number[]>("proc_kill", { pid, killTree, signal }, [pid]);
}

export async function serviceList(userMode = false): Promise<ServiceEntry[]> {
  const mockFallback: ServiceEntry[] = [
    {
      unitName: "bluetooth.service",
      description: "Bluetooth service",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      isUserUnit: userMode,
    },
    {
      unitName: "cups.service",
      description: "CUPS Scheduler",
      loadState: "loaded",
      activeState: "inactive",
      subState: "dead",
      isUserUnit: userMode,
    },
    {
      unitName: "dbus.service",
      description: "D-Bus System Message Bus",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      isUserUnit: userMode,
    },
  ];

  return safeInvoke<ServiceEntry[]>("service_list", { userMode }, mockFallback);
}

export async function serviceControl(
  unitName: string,
  action: string,
  userMode = false
): Promise<void> {
  return safeInvoke<void>("service_control", { unitName, action, userMode });
}

export async function autostartList(): Promise<AutostartEntry[]> {
  const mockFallback: AutostartEntry[] = [
    {
      fileName: "discord.desktop",
      name: "Discord",
      comment: "All-in-one voice and text chat",
      exec: "/usr/bin/discord",
      enabled: true,
      path: "/home/user/.config/autostart/discord.desktop",
    },
    {
      fileName: "steam.desktop",
      name: "Steam",
      comment: "Application for managing and playing games",
      exec: "/usr/bin/steam -silent",
      enabled: false,
      path: "/home/user/.config/autostart/steam.desktop",
    },
  ];

  return safeInvoke<AutostartEntry[]>("autostart_list", undefined, mockFallback);
}

export async function autostartToggle(fileName: string, enabled: boolean): Promise<void> {
  return safeInvoke<void>("autostart_toggle", { fileName, enabled });
}

// ================= In-App Agent IPC =================

export async function agentSendPrompt(prompt: string): Promise<TaskPlan> {
  const mockFallback: TaskPlan = {
    plan_id: `req_${Math.floor(Date.now() / 1000)}`,
    user_intent: prompt,
    steps: [
      {
        step_id: "s0",
        step_index: 0,
        tool_name: "tuneup.scan_junk",
        risk_tier: 1,
        description: "Scan system, browser, and package caches for reclaimable files",
        arguments: { categories: ["system", "browser", "package_cache", "dev"] },
        status: "completed",
        diff_summary: null,
      },
      {
        step_id: "s1",
        step_index: 1,
        tool_name: "tuneup.clean_junk",
        risk_tier: 2,
        description: "Move safe cache and temporary file targets into atomic quarantine store",
        arguments: { ruleIds: ["system-tmp", "chrome-cache"] },
        status: "waiting_approval",
        diff_summary: "Reclaims ~4.2 GB of storage with instant 1-click Undo",
      },
    ],
    total_disk_delta_bytes: -4509715660,
  };

  return safeInvoke<TaskPlan>("agent_send_prompt", { prompt }, mockFallback);
}

export async function agentGetActivePlan(): Promise<TaskPlan | null> {
  return safeInvoke<TaskPlan | null>("agent_get_active_plan", undefined, null);
}

export async function agentApproveStep(
  planId: string,
  stepIndex: number,
  signatureToken: string
): Promise<unknown> {
  return safeInvoke<unknown>("agent_approve_step", {
    planId,
    stepIndex,
    signatureToken,
  });
}

export async function agentRejectStep(
  planId: string,
  stepIndex: number
): Promise<void> {
  return safeInvoke<void>("agent_reject_step", { planId, stepIndex });
}

export async function agentAbort(): Promise<void> {
  return safeInvoke<void>("agent_abort", undefined);
}

export async function agentGetConfig(): Promise<AgentConfig> {
  const mockFallback: AgentConfig = {
    provider: "sovereign_offline",
    endpoint: "http://localhost:11434",
    model: "llama3.1:latest",
    apiKey: null,
  };
  return safeInvoke<AgentConfig>("agent_get_config", undefined, mockFallback);
}

export async function agentUpdateConfig(config: AgentConfig): Promise<void> {
  return safeInvoke<void>("agent_update_config", { config });
}
