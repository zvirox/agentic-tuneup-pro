use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutostartEntry {
    pub file_name: String,
    pub name: String,
    pub comment: Option<String>,
    pub exec: String,
    pub enabled: bool,
}
