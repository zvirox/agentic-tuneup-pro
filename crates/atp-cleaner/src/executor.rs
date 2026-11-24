use crate::rule::CleanerRule;
use crate::scanner::ParallelScanner;
use atp_core::{CoreError, ErrorKind};
use atp_safety::{AuditStore, QuarantineStore};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanExecutionOutput {
    pub session_id: String,
    pub bytes_freed: u64,
    pub files_count: usize,
    pub quarantine_path: PathBuf,
}

pub struct CleanerExecutor;

impl CleanerExecutor {
    /// Executes cleaner on selected rule IDs by staging files into quarantine and recording the audit log.
    pub fn execute_clean(
        selected_rule_ids: &[String],
        rules: &[CleanerRule],
        q_store: &QuarantineStore,
        audit_store: &AuditStore,
    ) -> Result<CleanExecutionOutput, CoreError> {
        let active_rules: Vec<CleanerRule> = rules
            .iter()
            .filter(|r| selected_rule_ids.contains(&r.id))
            .cloned()
            .collect();

        if active_rules.is_empty() {
            return Err(CoreError::new(
                ErrorKind::Cleaner,
                "cleaner.no_rules_selected",
                false,
                "No valid cleaner rules selected for execution.",
                None,
            ));
        }

        // Scan selected rules
        let summary = ParallelScanner::scan_rules(&active_rules);

        // Filter out rules blocked by active running applications
        let mut target_paths = Vec::new();
        let mut unblocked_rule_ids = Vec::new();
        let mut blocking_apps = Vec::new();

        for cat in &summary.categories {
            for r in &cat.rules {
                if r.running_apps_blocking.is_empty() {
                    target_paths.extend(r.matched_paths.clone());
                    unblocked_rule_ids.push(r.rule_id.clone());
                } else {
                    blocking_apps.extend(r.running_apps_blocking.clone());
                }
            }
        }
        blocking_apps.sort();
        blocking_apps.dedup();

        if target_paths.is_empty() {
            if !blocking_apps.is_empty() {
                return Err(CoreError::new(
                    ErrorKind::Cleaner,
                    "cleaner.browser_running",
                    true,
                    format!(
                        "Applications must be closed before cleaning: {}",
                        blocking_apps.join(", ")
                    ),
                    Some(serde_json::json!({ "blocking_apps": blocking_apps })),
                ));
            } else {
                return Ok(CleanExecutionOutput {
                    session_id: "none".to_string(),
                    bytes_freed: 0,
                    files_count: 0,
                    quarantine_path: q_store.base_dir().to_path_buf(),
                });
            }
        }

        let now_unix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let session_id = format!("q_{}_{:04x}", now_unix, fastrand::u16(..));

        let manifest = q_store.stage_files(&session_id, &unblocked_rule_ids, &target_paths)?;

        let expires_at = (now_unix + 7 * 86400) as i64;
        let _ = audit_store.record_quarantine_session(&manifest, expires_at);
        let _ = audit_store.record(
            "user",
            "cleaner.execute_clean",
            &unblocked_rule_ids.join(", "),
            2,
            "success",
            &format!(
                "{{\"bytes_freed\": {}, \"files_count\": {}, \"session_id\": \"{}\"}}",
                manifest.total_bytes,
                manifest.files.len(),
                session_id
            ),
        );

        Ok(CleanExecutionOutput {
            session_id: session_id.clone(),
            bytes_freed: manifest.total_bytes,
            files_count: manifest.files.len(),
            quarantine_path: q_store.session_path(&session_id),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_execute_clean_to_quarantine_and_audit() {
        let base_tmp = std::env::temp_dir().join(format!("atp_test_exec_{}", std::process::id()));
        let quarantine_dir = base_tmp.join("quarantine");
        let target_dir = base_tmp.join("junk");
        let db_path = base_tmp.join("audit.db");
        let _ = fs::create_dir_all(&quarantine_dir);
        let _ = fs::create_dir_all(&target_dir);

        let junk_file = target_dir.join("cache.dat");
        fs::write(&junk_file, b"junk data bytes 123").unwrap();

        let q_store = QuarantineStore::new(quarantine_dir.clone());
        let audit_store = AuditStore::open(&db_path).unwrap();

        let rule = CleanerRule {
            id: "junk-rule".into(),
            name: "Junk Rule".into(),
            category: "system".into(),
            description: "Test".into(),
            paths: vec![format!(
                "{target_dir_str}/*.dat",
                target_dir_str = target_dir.display()
            )],
            requires_closed: vec![],
            risk_tier: 2,
            explanation: "Testing".into(),
        };

        let output = CleanerExecutor::execute_clean(
            &["junk-rule".to_string()],
            &[rule],
            &q_store,
            &audit_store,
        )
        .expect("Clean execution must succeed");

        assert_eq!(output.files_count, 1);
        assert_eq!(output.bytes_freed, 19);
        assert!(
            !junk_file.exists(),
            "Original junk file should be moved into quarantine"
        );
        assert!(q_store.session_path(&output.session_id).exists());

        // Check SQLite session entry
        let sessions = audit_store.list_quarantine_sessions().unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, output.session_id);
        assert_eq!(sessions[0].status, "active");

        // Clean up
        let _ = fs::remove_dir_all(&base_tmp);
    }
}
