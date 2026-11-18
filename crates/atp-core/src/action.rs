use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskTier {
    #[serde(rename = "tier1_safe")]
    Tier1Safe = 1,
    #[serde(rename = "tier2_reversible")]
    Tier2Reversible = 2,
    #[serde(rename = "tier3_destructive")]
    Tier3Destructive = 3,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Step {
    pub step_id: String,
    pub step_index: usize,
    pub tool_name: String,
    pub risk_tier: RiskTier,
    pub description: String,
    pub arguments: serde_json::Value,
    pub approved: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Plan {
    pub plan_id: String,
    pub user_intent: String,
    pub steps: Vec<Step>,
    pub total_disk_delta_bytes: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Action {
    pub action_id: String,
    pub name: String,
    pub risk_tier: RiskTier,
    pub payload: serde_json::Value,
}
