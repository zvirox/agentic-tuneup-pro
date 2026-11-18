use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanerRule {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub paths: Vec<String>,
    #[serde(default)]
    pub requires_closed: Vec<String>,
    pub risk_tier: u8,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleFile {
    pub rule: Vec<CleanerRule>,
}
