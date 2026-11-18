use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleScanResult {
    pub rule_id: String,
    pub name: String,
    pub reclaimable_bytes: u64,
    pub file_count: usize,
    pub sample_paths: Vec<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryScanResult {
    pub category_id: String,
    pub display_name: String,
    pub reclaimable_bytes: u64,
    pub file_count: usize,
    pub rules: Vec<RuleScanResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummary {
    pub total_reclaimable_bytes: u64,
    pub total_file_count: usize,
    pub categories: Vec<CategoryScanResult>,
}
