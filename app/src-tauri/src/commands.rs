use tauri::{command, State};
use atp_cleaner::{CleanExecutionOutput, CleanerExecutor, ParallelScanner, RuleEngine, ScanSummary};
use atp_core::{AuditEntry, ExecutionResult, QuarantineSessionRecord};
use atp_monitor::{HealthScore, TelemetryMonitor, TelemetrySnapshot};
use atp_safety::{AuditStore, QuarantineStore};

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
        "{}",
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
