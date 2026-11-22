use std::fs;
use std::path::Path;
use rusqlite::{Connection, params};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use atp_core::{AuditEntry, CoreError, ErrorKind, QuarantineSessionRecord, RuleStateRecord};
use crate::quarantine::QuarantineManifest;

pub struct AuditStore {
    conn: Connection,
}

impl AuditStore {
    /// Opens or creates the SQLite audit and quarantine database.
    ///
    /// Applies WAL mode, foreign keys, busy timeout, and tightens file permissions to 0600.
    pub fn open(db_path: &Path) -> Result<Self, CoreError> {
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let conn = Connection::open(db_path).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.open_failed",
                false,
                format!("Failed to open SQLite database at {}: {e}", db_path.display()),
                None,
            )
        })?;

        #[cfg(unix)]
        if db_path.exists() {
            let _ = fs::set_permissions(db_path, fs::Permissions::from_mode(0o600));
        }

        let store = Self { conn };
        store.run_migrations()?;
        Ok(store)
    }

    /// Opens or creates the standard AuditStore at `$XDG_DATA_HOME/agentic-tuneup-pro/audit.db`.
    pub fn default_store() -> Result<Self, CoreError> {
        let base_data = std::env::var("XDG_DATA_HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
                std::path::PathBuf::from(home).join(".local/share")
            });
        let db_path = base_data.join("agentic-tuneup-pro/audit.db");
        Self::open(&db_path)
    }

    fn run_migrations(&self) -> Result<(), CoreError> {
        self.conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;

             CREATE TABLE IF NOT EXISTS audit_log (
                 entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
                 timestamp INTEGER NOT NULL,
                 initiator TEXT NOT NULL,
                 action_type TEXT NOT NULL,
                 target TEXT NOT NULL,
                 risk_tier INTEGER NOT NULL,
                 status TEXT NOT NULL,
                 details_json TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
             CREATE INDEX IF NOT EXISTS idx_audit_initiator ON audit_log(initiator);

             CREATE TABLE IF NOT EXISTS quarantine_sessions (
                 session_id TEXT PRIMARY KEY,
                 created_at INTEGER NOT NULL,
                 expires_at INTEGER NOT NULL,
                 rule_ids_json TEXT NOT NULL,
                 bytes_reclaimed INTEGER NOT NULL,
                 file_count INTEGER NOT NULL,
                 status TEXT NOT NULL,
                 restored_at INTEGER
             );
             CREATE INDEX IF NOT EXISTS idx_quarantine_created ON quarantine_sessions(created_at);

             CREATE TABLE IF NOT EXISTS user_rules (
                 rule_id TEXT PRIMARY KEY,
                 enabled INTEGER NOT NULL DEFAULT 1,
                 custom_toml TEXT,
                 updated_at INTEGER NOT NULL
             );"
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.migration_failed",
                false,
                format!("Failed to execute database migrations: {e}"),
                None,
            )
        })?;

        Ok(())
    }

    pub fn record(
        &self,
        initiator: &str,
        action_type: &str,
        target: &str,
        risk_tier: u8,
        status: &str,
        details_json: &str,
    ) -> Result<i64, CoreError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        self.conn.execute(
            "INSERT INTO audit_log (timestamp, initiator, action_type, target, risk_tier, status, details_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![now, initiator, action_type, target, risk_tier, status, details_json],
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.write_failed",
                false,
                format!("Failed to record audit entry: {e}"),
                None,
            )
        })?;

        Ok(self.conn.last_insert_rowid())
    }

    pub fn list_recent(&self, limit: usize) -> Result<Vec<AuditEntry>, CoreError> {
        self.list_filtered(limit, 0, None)
    }

    pub fn list_filtered(
        &self,
        limit: usize,
        offset: usize,
        initiator: Option<&str>,
    ) -> Result<Vec<AuditEntry>, CoreError> {
        let sql = match initiator {
            Some(_) => {
                "SELECT entry_id, timestamp, initiator, action_type, target, risk_tier, status, details_json
                 FROM audit_log WHERE initiator = ?1 ORDER BY timestamp DESC LIMIT ?2 OFFSET ?3"
            }
            None => {
                "SELECT entry_id, timestamp, initiator, action_type, target, risk_tier, status, details_json
                 FROM audit_log ORDER BY timestamp DESC LIMIT ?1 OFFSET ?2"
            }
        };

        let mut stmt = self.conn.prepare(sql).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.query_failed",
                false,
                format!("Failed to prepare audit query: {e}"),
                None,
            )
        })?;

        let rows = match initiator {
            Some(init) => stmt.query_map(params![init, limit as i64, offset as i64], Self::map_audit_row),
            None => stmt.query_map(params![limit as i64, offset as i64], Self::map_audit_row),
        }.map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.query_failed",
                false,
                format!("Failed to execute audit query: {e}"),
                None,
            )
        })?;

        let mut entries = Vec::new();
        for row in rows {
            entries.push(row.map_err(|e| {
                CoreError::new(
                    ErrorKind::Db,
                    "db.row_read_failed",
                    false,
                    format!("Failed to read audit row: {e}"),
                    None,
                )
            })?);
        }

        Ok(entries)
    }

    fn map_audit_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AuditEntry> {
        Ok(AuditEntry {
            entry_id: row.get(0)?,
            timestamp: row.get(1)?,
            initiator: row.get(2)?,
            action_type: row.get(3)?,
            target: row.get(4)?,
            risk_tier: row.get(5)?,
            status: row.get(6)?,
            details_json: row.get(7)?,
        })
    }

    pub fn record_quarantine_session(
        &self,
        manifest: &QuarantineManifest,
        expires_at: i64,
    ) -> Result<(), CoreError> {
        let rule_ids_json = serde_json::to_string(&manifest.rule_ids).unwrap_or_else(|_| "[]".to_string());

        self.conn.execute(
            "INSERT INTO quarantine_sessions
             (session_id, created_at, expires_at, rule_ids_json, bytes_reclaimed, file_count, status, restored_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', NULL)
             ON CONFLICT(session_id) DO UPDATE SET
                 rule_ids_json = excluded.rule_ids_json,
                 bytes_reclaimed = excluded.bytes_reclaimed,
                 file_count = excluded.file_count,
                 status = 'active';",
            params![
                manifest.session_id,
                manifest.created_at,
                expires_at,
                rule_ids_json,
                manifest.total_bytes as i64,
                manifest.files.len() as i64,
            ],
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.write_failed",
                false,
                format!("Failed to record quarantine session: {e}"),
                None,
            )
        })?;

        Ok(())
    }

    pub fn mark_quarantine_restored(&self, session_id: &str) -> Result<(), CoreError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        self.conn.execute(
            "UPDATE quarantine_sessions SET status = 'restored', restored_at = ?1 WHERE session_id = ?2",
            params![now, session_id],
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.write_failed",
                false,
                format!("Failed to mark quarantine session as restored: {e}"),
                None,
            )
        })?;

        Ok(())
    }

    pub fn mark_quarantine_purged(&self, session_id: &str) -> Result<(), CoreError> {
        self.conn.execute(
            "UPDATE quarantine_sessions SET status = 'purged' WHERE session_id = ?1",
            params![session_id],
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.write_failed",
                false,
                format!("Failed to mark quarantine session as purged: {e}"),
                None,
            )
        })?;

        Ok(())
    }

    pub fn list_quarantine_sessions(&self) -> Result<Vec<QuarantineSessionRecord>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT session_id, created_at, expires_at, rule_ids_json, bytes_reclaimed, file_count, status, restored_at
             FROM quarantine_sessions ORDER BY created_at DESC"
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.query_failed",
                false,
                format!("Failed to prepare quarantine sessions query: {e}"),
                None,
            )
        })?;

        let rows = stmt.query_map([], Self::map_quarantine_row).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.query_failed",
                false,
                format!("Failed to query quarantine sessions: {e}"),
                None,
            )
        })?;

        let mut records = Vec::new();
        for row in rows {
            records.push(row.map_err(|e| {
                CoreError::new(
                    ErrorKind::Db,
                    "db.row_read_failed",
                    false,
                    format!("Failed to read quarantine session row: {e}"),
                    None,
                )
            })?);
        }

        Ok(records)
    }

    fn map_quarantine_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<QuarantineSessionRecord> {
        let bytes: i64 = row.get(4)?;
        let count: i64 = row.get(5)?;
        Ok(QuarantineSessionRecord {
            session_id: row.get(0)?,
            created_at: row.get(1)?,
            expires_at: row.get(2)?,
            rule_ids_json: row.get(3)?,
            bytes_reclaimed: bytes as u64,
            file_count: count as usize,
            status: row.get(6)?,
            restored_at: row.get(7)?,
        })
    }

    pub fn set_rule_state(
        &self,
        rule_id: &str,
        enabled: bool,
        custom_toml: Option<&str>,
    ) -> Result<(), CoreError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        self.conn.execute(
            "INSERT INTO user_rules (rule_id, enabled, custom_toml, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(rule_id) DO UPDATE SET
                 enabled = excluded.enabled,
                 custom_toml = excluded.custom_toml,
                 updated_at = excluded.updated_at;",
            params![rule_id, if enabled { 1 } else { 0 }, custom_toml, now],
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.write_failed",
                false,
                format!("Failed to set user rule state: {e}"),
                None,
            )
        })?;

        Ok(())
    }

    pub fn get_rule_state(&self, rule_id: &str) -> Result<Option<RuleStateRecord>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT rule_id, enabled, custom_toml, updated_at FROM user_rules WHERE rule_id = ?1"
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.query_failed",
                false,
                format!("Failed to prepare rule state query: {e}"),
                None,
            )
        })?;

        let mut rows = stmt.query_map(params![rule_id], Self::map_rule_row).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.query_failed",
                false,
                format!("Failed to execute rule state query: {e}"),
                None,
            )
        })?;

        if let Some(first) = rows.next() {
            let record = first.map_err(|e| {
                CoreError::new(
                    ErrorKind::Db,
                    "db.row_read_failed",
                    false,
                    format!("Failed reading rule state row: {e}"),
                    None,
                )
            })?;
            Ok(Some(record))
        } else {
            Ok(None)
        }
    }

    fn map_rule_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<RuleStateRecord> {
        let enabled_int: i32 = row.get(1)?;
        Ok(RuleStateRecord {
            rule_id: row.get(0)?,
            enabled: enabled_int != 0,
            custom_toml: row.get(2)?,
            updated_at: row.get(3)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_db(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("atp_test_db_{name}_{}.sqlite", std::process::id()));
        let _ = fs::remove_file(&path);
        path
    }

    #[test]
    fn test_audit_logging_and_filtering() {
        let db_path = temp_db("audit");
        let store = AuditStore::open(&db_path).expect("DB open must succeed");

        let id1 = store.record("user", "clean", "cache.thumbnails", 1, "success", "{\"bytes\": 1024}").unwrap();
        let id2 = store.record("starship", "purge", "orphans", 3, "success", "{\"pkgs\": 2}").unwrap();

        assert!(id1 > 0);
        assert!(id2 > id1);

        let all = store.list_recent(10).unwrap();
        assert_eq!(all.len(), 2);

        let starship_only = store.list_filtered(10, 0, Some("starship")).unwrap();
        assert_eq!(starship_only.len(), 1);
        assert_eq!(starship_only[0].initiator, "starship");
        assert_eq!(starship_only[0].risk_tier, 3);

        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_quarantine_session_lifecycle() {
        let db_path = temp_db("quarantine");
        let store = AuditStore::open(&db_path).unwrap();

        let manifest = QuarantineManifest {
            session_id: "sess_100".to_string(),
            created_at: 1700000000,
            rule_ids: vec!["rule.a".to_string(), "rule.b".to_string()],
            total_bytes: 4096,
            files: vec![],
        };

        store.record_quarantine_session(&manifest, 1700000000 + 7 * 86400).unwrap();

        let sessions = store.list_quarantine_sessions().unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, "sess_100");
        assert_eq!(sessions[0].status, "active");
        assert_eq!(sessions[0].bytes_reclaimed, 4096);

        store.mark_quarantine_restored("sess_100").unwrap();
        let sessions_after = store.list_quarantine_sessions().unwrap();
        assert_eq!(sessions_after[0].status, "restored");
        assert!(sessions_after[0].restored_at.is_some());

        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_user_rule_overrides() {
        let db_path = temp_db("rules");
        let store = AuditStore::open(&db_path).unwrap();

        assert!(store.get_rule_state("browser.cookies").unwrap().is_none());

        store.set_rule_state("browser.cookies", false, Some("[keep_domains]\nlist = [\"github.com\"]")).unwrap();

        let state = store.get_rule_state("browser.cookies").unwrap().expect("Rule state must exist");
        assert!(!state.enabled);
        assert_eq!(state.custom_toml.as_deref(), Some("[keep_domains]\nlist = [\"github.com\"]"));

        let _ = fs::remove_file(&db_path);
    }
}
