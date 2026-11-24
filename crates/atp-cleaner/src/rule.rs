use atp_core::{CoreError, ErrorKind, RiskTier};
use atp_safety::ProtectedValidator;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

impl CleanerRule {
    pub fn get_risk_tier(&self) -> RiskTier {
        match self.risk_tier {
            1 => RiskTier::Tier1Safe,
            2 => RiskTier::Tier2Reversible,
            3 => RiskTier::Tier3Destructive,
            _ => RiskTier::Tier2Reversible,
        }
    }

    /// Verifies whether the rule paths attempt to match protected credentials or OS roots.
    pub fn validate_safety(&self) -> Result<(), CoreError> {
        for path_pattern in &self.paths {
            let sample_path = PathBuf::from(path_pattern.replace('*', "safe_sample"));
            ProtectedValidator::validate(&sample_path)?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleFile {
    pub rule: Vec<CleanerRule>,
}

const EMBEDDED_RULES: &[&str] = &[
    include_str!("../../../rules/app_caches.toml"),
    include_str!("../../../rules/browsers.toml"),
    include_str!("../../../rules/dev_artifacts.toml"),
    include_str!("../../../rules/package_caches.toml"),
    include_str!("../../../rules/system.toml"),
];

pub struct RuleEngine {
    rules: Vec<CleanerRule>,
}

impl Default for RuleEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl RuleEngine {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    pub fn with_rules(rules: Vec<CleanerRule>) -> Self {
        Self { rules }
    }

    pub fn rules(&self) -> &[CleanerRule] {
        &self.rules
    }

    pub fn load_from_str(content: &str) -> Result<Vec<CleanerRule>, CoreError> {
        let file: RuleFile = toml::from_str(content).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "cleaner.rule_parse_error",
                false,
                format!("Failed to parse rule TOML: {e}"),
                None,
            )
        })?;

        for r in &file.rule {
            r.validate_safety()?;
        }

        Ok(file.rule)
    }

    pub fn load_from_dir(dir: &Path) -> Result<Vec<CleanerRule>, CoreError> {
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut loaded = Vec::new();
        let entries = fs::read_dir(dir).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "cleaner.rules_dir_read_failed",
                false,
                format!("Failed reading rules directory {}: {e}", dir.display()),
                None,
            )
        })?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("toml") {
                let content = fs::read_to_string(&path).map_err(|e| {
                    CoreError::new(
                        ErrorKind::Cleaner,
                        "cleaner.rule_read_failed",
                        false,
                        format!("Failed to read rule file {}: {e}", path.display()),
                        None,
                    )
                })?;

                let mut rules = Self::load_from_str(&content)?;
                loaded.append(&mut rules);
            }
        }

        Ok(loaded)
    }

    /// Discovers and loads rules from:
    /// 1. Built-in embedded rules (guarantees core rules are always available)
    /// 2. `/usr/share/agentic-tuneup-pro/rules` and local `./rules`
    /// 3. `$XDG_CONFIG_HOME/agentic-tuneup-pro/rules` (user custom overrides)
    pub fn discover_and_load() -> Result<Self, CoreError> {
        let mut all_rules = Vec::new();

        // 1. Built-in embedded rules
        for embedded_toml in EMBEDDED_RULES {
            if let Ok(mut embedded) = Self::load_from_str(embedded_toml) {
                all_rules.append(&mut embedded);
            }
        }

        // 2. System and app-bundled rules
        let candidate_dirs = [
            PathBuf::from("/usr/share/agentic-tuneup-pro/rules"),
            PathBuf::from("/usr/local/share/agentic-tuneup-pro/rules"),
            PathBuf::from("rules"),
            PathBuf::from("../../rules"),
            PathBuf::from("../rules"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../rules"),
        ];

        for candidate in candidate_dirs {
            if candidate.exists() && candidate.is_dir() {
                if let Ok(mut bundled) = Self::load_from_dir(&candidate) {
                    if !bundled.is_empty() {
                        all_rules.append(&mut bundled);
                        break;
                    }
                }
            }
        }

        // 2. User custom rules
        let config_base = std::env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
                PathBuf::from(home).join(".config")
            });
        let user_rules_dir = config_base.join("agentic-tuneup-pro/rules");
        if user_rules_dir.exists() {
            let mut user_rules = Self::load_from_dir(&user_rules_dir)?;
            all_rules.append(&mut user_rules);
        }

        // Deduplicate by rule ID (user rules override bundled ones)
        let mut unique_rules: std::collections::HashMap<String, CleanerRule> =
            std::collections::HashMap::new();
        for rule in all_rules {
            unique_rules.insert(rule.id.clone(), rule);
        }

        let mut sorted: Vec<CleanerRule> = unique_rules.into_values().collect();
        sorted.sort_by(|a, b| a.id.cmp(&b.id));

        Ok(Self { rules: sorted })
    }

    pub fn get_rule(&self, rule_id: &str) -> Option<&CleanerRule> {
        self.rules.iter().find(|r| r.id == rule_id)
    }

    pub fn categories(&self) -> Vec<String> {
        let mut cats: Vec<String> = self.rules.iter().map(|r| r.category.clone()).collect();
        cats.sort();
        cats.dedup();
        cats
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_rule_toml() {
        let toml_str = r#"
        [[rule]]
        id = "test-cache"
        name = "Test Cache"
        category = "system"
        description = "Test temporary files"
        paths = ["/tmp/test_dir/*"]
        requires_closed = []
        risk_tier = 2
        explanation = "Safe to clean"
        "#;

        let rules = RuleEngine::load_from_str(toml_str).expect("Valid rule TOML must parse");
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].id, "test-cache");
        assert_eq!(rules[0].get_risk_tier(), RiskTier::Tier2Reversible);
    }

    #[test]
    fn test_rejects_rule_targeting_protected_passwords() {
        let malicious_toml = r#"
        [[rule]]
        id = "stolen-passwords"
        name = "Browser Passwords"
        category = "browser"
        description = "Steal passwords"
        paths = ["~/.config/google-chrome/Default/Login Data"]
        requires_closed = []
        risk_tier = 2
        explanation = "Malicious"
        "#;

        let res = RuleEngine::load_from_str(malicious_toml);
        assert!(
            res.is_err(),
            "ProtectedValidator must block rule with password targets"
        );
    }

    #[test]
    fn test_discover_rules_from_repo() {
        let engine = RuleEngine::discover_and_load().expect("Discover must succeed");
        assert!(
            !engine.rules().is_empty(),
            "Must load rules from rules/ directory"
        );
        assert!(engine.categories().contains(&"browser".to_string()));
        assert!(engine.categories().contains(&"system".to_string()));
    }
}
