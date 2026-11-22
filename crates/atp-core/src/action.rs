use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskTier {
    #[serde(rename = "tier1_safe")]
    Tier1Safe = 1,
    #[serde(rename = "tier2_reversible")]
    Tier2Reversible = 2,
    #[serde(rename = "tier3_destructive")]
    Tier3Destructive = 3,
}

impl RiskTier {
    #[inline]
    pub fn is_safe(self) -> bool {
        self == Self::Tier1Safe
    }

    #[inline]
    pub fn is_reversible(self) -> bool {
        self == Self::Tier2Reversible
    }

    #[inline]
    pub fn is_destructive(self) -> bool {
        self == Self::Tier3Destructive
    }

    #[inline]
    pub fn requires_human_approval(self) -> bool {
        self == Self::Tier3Destructive
    }

    pub fn display_badge_label(self) -> &'static str {
        match self {
            Self::Tier1Safe => "TIER 1 (SAFE)",
            Self::Tier2Reversible => "TIER 2 (REVERSIBLE)",
            Self::Tier3Destructive => "TIER 3 (DESTRUCTIVE)",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    WaitingApproval,
    Executing,
    Completed,
    Failed,
    Rejected,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Step {
    pub step_id: String,
    pub step_index: usize,
    pub tool_name: String,
    pub risk_tier: RiskTier,
    pub description: String,
    pub arguments: serde_json::Value,
    pub status: StepStatus,
    pub diff_summary: Option<String>,
}

impl Step {
    pub fn new(
        step_id: impl Into<String>,
        step_index: usize,
        tool_name: impl Into<String>,
        risk_tier: RiskTier,
        description: impl Into<String>,
        arguments: serde_json::Value,
    ) -> Self {
        let status = if risk_tier.requires_human_approval() {
            StepStatus::WaitingApproval
        } else {
            StepStatus::Pending
        };

        Self {
            step_id: step_id.into(),
            step_index,
            tool_name: tool_name.into(),
            risk_tier,
            description: description.into(),
            arguments,
            status,
            diff_summary: None,
        }
    }

    pub fn mark_approved(&mut self) {
        if self.status == StepStatus::WaitingApproval {
            self.status = StepStatus::Pending;
        }
    }

    pub fn mark_rejected(&mut self) {
        self.status = StepStatus::Rejected;
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Plan {
    pub plan_id: String,
    pub user_intent: String,
    pub steps: Vec<Step>,
    pub total_disk_delta_bytes: i64,
}

impl Plan {
    pub fn new(plan_id: impl Into<String>, user_intent: impl Into<String>) -> Self {
        Self {
            plan_id: plan_id.into(),
            user_intent: user_intent.into(),
            steps: Vec::new(),
            total_disk_delta_bytes: 0,
        }
    }

    pub fn add_step(&mut self, step: Step) {
        self.steps.push(step);
    }

    pub fn has_pending_approvals(&self) -> bool {
        self.steps.iter().any(|s| s.status == StepStatus::WaitingApproval)
    }

    pub fn is_executable(&self) -> bool {
        !self.has_pending_approvals() && self.steps.iter().all(|s| s.status != StepStatus::Rejected)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Action {
    pub action_id: String,
    pub name: String,
    pub risk_tier: RiskTier,
    pub payload: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_risk_tier_invariants() {
        assert!(RiskTier::Tier1Safe.is_safe());
        assert!(!RiskTier::Tier1Safe.requires_human_approval());

        assert!(RiskTier::Tier2Reversible.is_reversible());
        assert!(!RiskTier::Tier2Reversible.requires_human_approval());

        assert!(RiskTier::Tier3Destructive.is_destructive());
        assert!(RiskTier::Tier3Destructive.requires_human_approval());
    }

    #[test]
    fn test_plan_approval_lifecycle() {
        let mut plan = Plan::new("p1", "Clean system caches and purge orphans");

        let step1 = Step::new("s1", 0, "tuneup.scan_junk", RiskTier::Tier1Safe, "Scan caches", serde_json::json!({}));
        let mut step2 = Step::new("s2", 1, "tuneup.purge_orphans", RiskTier::Tier3Destructive, "Purge 4 orphans", serde_json::json!({}));

        assert_eq!(step1.status, StepStatus::Pending);
        assert_eq!(step2.status, StepStatus::WaitingApproval);

        plan.add_step(step1);
        plan.add_step(step2.clone());

        assert!(plan.has_pending_approvals());
        assert!(!plan.is_executable());

        step2.mark_approved();
        assert_eq!(step2.status, StepStatus::Pending);
    }
}
