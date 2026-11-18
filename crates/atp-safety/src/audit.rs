use std::path::Path;
use rusqlite::{Connection, params};
use atp_core::{AuditEntry, CoreError, ErrorKind};

pub struct AuditStore {
    conn: Connection,
}

impl AuditStore {
    pub fn open(db_path: &Path) -> Result<Self, CoreError> {
        let conn = Connection::open(db_path).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.open_failed",
                false,
                format!("Failed to open SQLite audit database: {e}"),
                None,
            )
        })?;

        conn.execute_batch(
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
             CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);",
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.migration_failed",
                false,
                format!("Failed to initialize audit database schema: {e}"),
                None,
            )
        })?;

        Ok(Self { conn })
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
        let mut stmt = self.conn.prepare(
            "SELECT entry_id, timestamp, initiator, action_type, target, risk_tier, status, details_json
             FROM audit_log ORDER BY timestamp DESC LIMIT ?1"
        ).map_err(|e| {
            CoreError::new(
                ErrorKind::Db,
                "db.query_failed",
                false,
                format!("Failed to prepare audit query: {e}"),
                None,
            )
        })?;

        let rows = stmt.query_map(params![limit as i64], |row| {
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
        }).map_err(|e| {
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
}
