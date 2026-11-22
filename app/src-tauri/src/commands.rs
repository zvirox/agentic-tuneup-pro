use tauri::command;
use atp_core::{AuditEntry, ExecutionResult, QuarantineSessionRecord};
use atp_safety::{AuditStore, QuarantineStore};

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
