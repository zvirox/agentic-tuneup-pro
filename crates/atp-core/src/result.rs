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
