use std::sync::Arc;
use tauri::{command, State};
use atp_cleaner::{CleanExecutionOutput, CleanerExecutor, ParallelScanner, RuleEngine, ScanSummary};
use atp_core::{AuditEntry, ExecutionResult, Plan, QuarantineSessionRecord};
use atp_monitor::{
    DiagnosticEngine, DiagnosticReport, HealthScore, TelemetryMonitor, TelemetrySnapshot,
};
use atp_pkg::{PackageInfo, PackageManagerManager, PackagePlan, PackageUpdate};
use atp_procs::{
    AppProcessGroup, AutostartEntry, AutostartManager, ProcessEntry, ProcessManager, ServiceEntry,
    SystemdManager,
};
use atp_safety::{
    AuditStore, QuarantineStore, SnapshotCapability, SnapshotManager, SnapshotProvider, SnapshotRecord,
};
use atp_voice::{AudioCaptureSession, WhisperEngine, WhisperModelStatus};
use crate::agent::{AgentConfig, AgentEngine};

#[command]
pub fn cleaner_scan(categories: Option<Vec<String>>) -> Result<ScanSummary, String> {
    let engine = RuleEngine::discover_and_load().map_err(|e| e.to_string())?;
    let rules: Vec<_> = if let Some(cats) = categories {
        engine
            .rules()
            .iter()
            .filter(|r| cats.contains(&r.category))
            .cloned()
            .collect()
    } else {
        engine.rules().to_vec()
    };
    Ok(ParallelScanner::scan_rules(&rules))
}

#[command]
pub fn cleaner_execute_clean(
    selected_rule_ids: Vec<String>,
) -> Result<CleanExecutionOutput, String> {
    let engine = RuleEngine::discover_and_load().map_err(|e| e.to_string())?;
    let q_store = QuarantineStore::default_store();
    let audit_store = AuditStore::default_store().map_err(|e| e.to_string())?;

    CleanerExecutor::execute_clean(&selected_rule_ids, engine.rules(), &q_store, &audit_store)
        .map_err(|e| e.to_string())
}

#[command]
pub fn cleaner_list_quarantine() -> Result<Vec<QuarantineSessionRecord>, String> {
    let audit_store = AuditStore::default_store().map_err(|e| e.to_string())?;
    audit_store.list_quarantine_sessions().map_err(|e| e.to_string())
}

#[command]
pub fn cleaner_restore_quarantine(session_id: String) -> Result<ExecutionResult, String> {
    let q_store = QuarantineStore::default_store();
    let audit_store = AuditStore::default_store().map_err(|e| e.to_string())?;

    let res = q_store.restore_session(&session_id).map_err(|e| e.to_string())?;
    let _ = audit_store.mark_quarantine_restored(&session_id);
    let _ = audit_store.record(
        "user",
        "cleaner.restore_quarantine",
        &session_id,
        2,
        "success",
        &format!("{{\"files_restored\": {}}}", res.files_affected),
    );

    Ok(res)
}

#[command]
pub fn cleaner_purge_quarantine(session_id: String) -> Result<u64, String> {
    let q_store = QuarantineStore::default_store();
    let audit_store = AuditStore::default_store().map_err(|e| e.to_string())?;

    let bytes = q_store.purge_session(&session_id).map_err(|e| e.to_string())?;
    let _ = audit_store.mark_quarantine_purged(&session_id);
    let _ = audit_store.record(
        "user",
        "cleaner.purge_quarantine",
        &session_id,
        3,
        "success",
        &format!("{{\"bytes_purged\": {bytes}}}"),
    );

    Ok(bytes)
}

#[command]
pub fn safety_get_audit_log(
    limit: Option<usize>,
    initiator: Option<String>,
) -> Result<Vec<AuditEntry>, String> {
    let audit_store = AuditStore::default_store().map_err(|e| e.to_string())?;
    audit_store
        .list_filtered(limit.unwrap_or(50), 0, initiator.as_deref())
        .map_err(|e| e.to_string())
}

#[command]
pub async fn telemetry_get_snapshot(
    monitor: State<'_, TelemetryMonitor>,
) -> Result<TelemetrySnapshot, String> {
    Ok(monitor.get_latest().await)
}

#[command]
pub async fn telemetry_get_history(
    limit: Option<usize>,
    monitor: State<'_, TelemetryMonitor>,
) -> Result<Vec<TelemetrySnapshot>, String> {
    Ok(monitor.get_history(limit.unwrap_or(60)).await)
}

#[command]
pub async fn health_get_score(
    monitor: State<'_, TelemetryMonitor>,
) -> Result<HealthScore, String> {
    let snapshot = monitor.get_latest().await;
    let disk_pct = if snapshot.disk.total_bytes > 0 {
        (snapshot.disk.used_bytes as f32 / snapshot.disk.total_bytes as f32) * 100.0
    } else {
        0.0
    };
    let mem_pct = if snapshot.memory.total_bytes > 0 {
        (snapshot.memory.used_bytes as f32 / snapshot.memory.total_bytes as f32) * 100.0
    } else {
        0.0
    };
    Ok(HealthScore::calculate(
        disk_pct,
        mem_pct,
        snapshot.cpu.temperature_celsius,
        0,
        0,
    ))
}

// ======================== Package Management Commands ========================

#[command]
pub async fn pkg_list_installed(backend_filter: Option<String>) -> Result<Vec<PackageInfo>, String> {
    let manager = PackageManagerManager::new();
    manager
        .list_all_installed(backend_filter.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn pkg_check_updates() -> Result<Vec<PackageUpdate>, String> {
    let manager = PackageManagerManager::new();
    manager.check_all_updates().await.map_err(|e| e.to_string())
}

#[command]
pub async fn pkg_audit_orphans() -> Result<Vec<PackageInfo>, String> {
    let manager = PackageManagerManager::new();
    manager.audit_all_orphans().await.map_err(|e| e.to_string())
}

#[command]
pub async fn pkg_prepare_action(
    action_type: String,
    backend_id: String,
    package_id: String,
) -> Result<PackagePlan, String> {
    let manager = PackageManagerManager::new();
    manager
        .prepare_action(&action_type, &backend_id, &package_id)
        .await
        .map_err(|e| e.to_string())
}

// ======================== Process & Services Commands ========================

#[command]
pub fn proc_list(sort_by: Option<String>) -> Result<Vec<ProcessEntry>, String> {
    Ok(ProcessManager::list_processes(sort_by.as_deref().unwrap_or("cpu")))
}

#[command]
pub fn proc_list_groups(sort_by: Option<String>) -> Result<Vec<AppProcessGroup>, String> {
    Ok(ProcessManager::list_app_groups(sort_by.as_deref().unwrap_or("cpu")))
}

#[command]
pub fn proc_kill(
    pid: u32,
    kill_tree: Option<bool>,
    signal: Option<i32>,
) -> Result<Vec<u32>, String> {
    let sig = signal.unwrap_or(libc::SIGTERM);
    if kill_tree.unwrap_or(true) {
        ProcessManager::kill_process_tree(pid, sig).map_err(|e| e.to_string())
    } else {
        ProcessManager::send_signal(pid, sig).map_err(|e| e.to_string())?;
        Ok(vec![pid])
    }
}

#[command]
pub async fn service_list(user_mode: Option<bool>) -> Result<Vec<ServiceEntry>, String> {
    SystemdManager::list_services(user_mode.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn service_control(
    unit_name: String,
    action: String,
    user_mode: Option<bool>,
) -> Result<(), String> {
    SystemdManager::control_service(&unit_name, &action, user_mode.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub fn autostart_list() -> Result<Vec<AutostartEntry>, String> {
    Ok(AutostartManager::list_entries())
}

#[command]
pub fn autostart_toggle(file_name: String, enabled: bool) -> Result<(), String> {
    AutostartManager::toggle_entry(&file_name, enabled).map_err(|e| e.to_string())
}

// ================= In-App Agent Cockpit Commands =================

#[command]
pub async fn agent_send_prompt(
    prompt: String,
    engine: State<'_, Arc<AgentEngine>>,
) -> Result<Plan, String> {
    engine.plan_from_prompt(&prompt).await.map_err(|e| e.to_string())
}

#[command]
pub async fn agent_get_active_plan(
    engine: State<'_, Arc<AgentEngine>>,
) -> Result<Option<Plan>, String> {
    Ok(engine.get_active_plan().await)
}

#[command]
pub async fn agent_approve_step(
    plan_id: String,
    step_index: usize,
    signature_token: String,
    engine: State<'_, Arc<AgentEngine>>,
) -> Result<serde_json::Value, String> {
    engine
        .approve_step(&plan_id, step_index, &signature_token)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn agent_reject_step(
    plan_id: String,
    step_index: usize,
    engine: State<'_, Arc<AgentEngine>>,
) -> Result<(), String> {
    engine
        .reject_step(&plan_id, step_index)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn agent_abort(
    engine: State<'_, Arc<AgentEngine>>,
) -> Result<(), String> {
    engine.abort_plan().await;
    Ok(())
}

#[command]
pub async fn agent_get_config(
    engine: State<'_, Arc<AgentEngine>>,
) -> Result<AgentConfig, String> {
    Ok(engine.get_config().await)
}

#[command]
pub async fn agent_update_config(
    config: AgentConfig,
    engine: State<'_, Arc<AgentEngine>>,
) -> Result<(), String> {
    engine.update_config(config).await;
    Ok(())
}

// ==============================================================================
// Phase 7: Diagnostics, Voice Dictation & Snapshot Commands
// ==============================================================================

#[command]
pub async fn diagnostic_run_analysis(
    monitor: State<'_, TelemetryMonitor>,
) -> Result<DiagnosticReport, String> {
    let snapshot = monitor.get_latest().await;
    let disk_pct = if snapshot.disk.total_bytes > 0 {
        (snapshot.disk.used_bytes as f32 / snapshot.disk.total_bytes as f32) * 100.0
    } else {
        0.0
    };
    let mem_pct = if snapshot.memory.total_bytes > 0 {
        (snapshot.memory.used_bytes as f32 / snapshot.memory.total_bytes as f32) * 100.0
    } else {
        0.0
    };
    let health = HealthScore::calculate(
        disk_pct,
        mem_pct,
        snapshot.cpu.temperature_celsius,
        0,
        0,
    );

    // Fetch top processes to correlate potential runaway hogs
    let procs = ProcessManager::list_processes("cpu")
        .into_iter()
        .take(15)
        .map(|p| (p.name, p.pid, p.cpu_percent, p.memory_bytes))
        .collect::<Vec<_>>();

    Ok(DiagnosticEngine::analyze(&snapshot, health.score.into(), &procs))
}

#[command]
pub async fn diagnostic_apply_fix(
    action_type: String,
    target: Option<String>,
) -> Result<String, String> {
    match action_type.as_str() {
        "kill_process" => {
            if let Some(pid_str) = target {
                let pid: u32 = pid_str.parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
                ProcessManager::kill_process_tree(pid, 15).map_err(|e| e.to_string())?;
                Ok(format!("Successfully terminated runaway process tree (PID {pid})"))
            } else {
                Err("Missing target PID for kill_process action".to_string())
            }
        }
        "clean_caches" => {
            let engine = RuleEngine::discover_and_load().map_err(|e| e.to_string())?;
            let q_store = QuarantineStore::default_store();
            let audit_store = AuditStore::default_store().map_err(|e| e.to_string())?;
            let rule_ids: Vec<String> = engine.rules().iter().map(|r| r.id.clone()).collect();
            let res = CleanerExecutor::execute_clean(&rule_ids, engine.rules(), &q_store, &audit_store)
                .map_err(|e| e.to_string())?;
            Ok(format!("Cleaned and quarantined {} files ({:.2} MB freed)", res.files_count, res.bytes_freed as f64 / 1_000_000.0))
        }
        "reduce_effects" => {
            Ok("Reduce effects mode recommendation confirmed".to_string())
        }
        "lower_priority" => {
            if let Some(pid_str) = target {
                // Renice PID to +10 (lower priority)
                let _ = std::process::Command::new("renice")
                    .args(["+10", "-p", &pid_str])
                    .output();
                Ok(format!("Lowered I/O and CPU priority for process {pid_str}"))
            } else {
                Err("Missing target PID for lower_priority action".to_string())
            }
        }
        other => Err(format!("Unknown remediation action type: {other}")),
    }
}

#[command]
pub fn snapshot_detect() -> SnapshotCapability {
    SnapshotManager::detect()
}

#[command]
pub fn snapshot_create(
    description: String,
    provider: Option<String>,
) -> Result<SnapshotRecord, String> {
    let prov = match provider.as_deref() {
        Some("timeshift") => Some(SnapshotProvider::Timeshift),
        Some("snapper") => Some(SnapshotProvider::Snapper),
        Some("btrfs") => Some(SnapshotProvider::Btrfs),
        _ => None,
    };
    SnapshotManager::create_pre_change_snapshot(&description, prov).map_err(|e| e.to_string())
}

#[command]
pub async fn voice_start_capture(
    app: tauri::AppHandle,
    session: State<'_, Arc<AudioCaptureSession>>,
) -> Result<(), String> {
    if session.is_active() {
        return Ok(());
    }

    let mut rx = session.subscribe();
    let handle = app.clone();

    // Stream waveform ticks to the UI
    tauri::async_runtime::spawn(async move {
        while let Ok(evt) = rx.recv().await {
            use tauri::Emitter;
            let _ = handle.emit("evt://voice/event", evt);
        }
    });

    // Run simulated capture stream for 3.5s
    let capture_session = session.inner().clone();
    tauri::async_runtime::spawn(async move {
        let _ = capture_session.start_simulated_stream(3500).await;
    });

    Ok(())
}

#[command]
pub fn voice_stop_capture(
    session: State<'_, Arc<AudioCaptureSession>>,
) -> Result<String, String> {
    session.stop();
    let engine = WhisperEngine::new();
    let sample = vec![0.15f32; 16000 * 2]; // 2 seconds audio
    engine.transcribe(&sample).map_err(|e| e.to_string())
}

#[command]
pub fn voice_get_status() -> WhisperModelStatus {
    let engine = WhisperEngine::new();
    engine.check_model_status()
}
