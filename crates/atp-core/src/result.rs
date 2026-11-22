use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub bytes_reclaimed: u64,
    pub files_affected: usize,
    pub undo_session_id: Option<String>,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditEntry {
    pub entry_id: i64,
    pub timestamp: i64,
    pub initiator: String,
    pub action_type: String,
    pub target: String,
    pub risk_tier: u8,
    pub status: String,
    pub details_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuarantineSessionRecord {
    pub session_id: String,
    pub created_at: i64,
    pub expires_at: i64,
    pub rule_ids_json: String,
    pub bytes_reclaimed: u64,
    pub file_count: usize,
    pub status: String,
    pub restored_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuleStateRecord {
    pub rule_id: String,
    pub enabled: bool,
    pub custom_toml: Option<String>,
    pub updated_at: i64,
}
