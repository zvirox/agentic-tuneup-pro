use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::{ProcessesToUpdate, System};

use crate::rule::CleanerRule;
use atp_safety::ProtectedValidator;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleScanResult {
    pub rule_id: String,
    pub name: String,
    pub category: String,
    pub risk_tier: u8,
    pub reclaimable_bytes: u64,
    pub file_count: usize,
    pub sample_paths: Vec<PathBuf>,
    pub matched_paths: Vec<PathBuf>,
    pub running_apps_blocking: Vec<String>,
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
    pub blocked_by_running_apps: bool,
}

pub struct ParallelScanner;

impl ParallelScanner {
    /// Detects all running processes currently executing on the machine.
    pub fn get_running_process_names() -> HashSet<String> {
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::All, true);

        let mut names = HashSet::new();
        for (_, process) in sys.processes() {
            let name = process.name().to_string_lossy().to_lowercase();
            names.insert(name);
        }
        names
    }

    /// Scans a collection of rules in parallel using Rayon.
    pub fn scan_rules(rules: &[CleanerRule]) -> ScanSummary {
        let running_processes = Self::get_running_process_names();

        // Scan rules concurrently
        let rule_results: Vec<RuleScanResult> = rules
            .par_iter()
            .map(|rule| Self::scan_single_rule(rule, &running_processes))
            .collect();

        // Group into categories
        let mut category_map: std::collections::BTreeMap<String, Vec<RuleScanResult>> =
            std::collections::BTreeMap::new();

        let mut total_reclaimable_bytes = 0u64;
        let mut total_file_count = 0usize;
        let mut any_blocked = false;

        for r in rule_results {
            total_reclaimable_bytes += r.reclaimable_bytes;
            total_file_count += r.file_count;
            if !r.running_apps_blocking.is_empty() {
                any_blocked = true;
            }
            category_map.entry(r.category.clone()).or_default().push(r);
        }

        let mut categories = Vec::new();
        for (cat_id, cat_rules) in category_map {
            let cat_bytes: u64 = cat_rules.iter().map(|r| r.reclaimable_bytes).sum();
            let cat_files: usize = cat_rules.iter().map(|r| r.file_count).sum();
            let display_name = Self::format_category_title(&cat_id);

            categories.push(CategoryScanResult {
                category_id: cat_id,
                display_name,
                reclaimable_bytes: cat_bytes,
                file_count: cat_files,
                rules: cat_rules,
            });
        }

        ScanSummary {
            total_reclaimable_bytes,
            total_file_count,
            categories,
            blocked_by_running_apps: any_blocked,
        }
    }

    fn scan_single_rule(rule: &CleanerRule, running_processes: &HashSet<String>) -> RuleScanResult {
        let home_dir = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let mut matched_set: HashSet<PathBuf> = HashSet::new();
        let mut reclaimable_bytes = 0u64;

        // Check running application locks
        let mut running_apps_blocking = Vec::new();
        for app in &rule.requires_closed {
            if running_processes.contains(&app.to_lowercase()) {
                running_apps_blocking.push(app.clone());
            }
        }

        // Expand each glob pattern
        for raw_pattern in &rule.paths {
            let expanded_pattern = if raw_pattern.starts_with('~') {
                raw_pattern.replacen('~', &home_dir, 1)
            } else {
                raw_pattern.clone()
            };

            let pattern_has_recursive = expanded_pattern.ends_with("**");

            if let Ok(entries) = glob::glob(&expanded_pattern) {
                for entry in entries.flatten() {
                    if ProtectedValidator::validate(&entry).is_err() {
                        continue;
                    }

                    if entry.is_file() {
                        if matched_set.insert(entry.clone()) {
                            if let Ok(meta) = fs::symlink_metadata(&entry) {
                                reclaimable_bytes += meta.len();
                            }
                        }
                    } else if entry.is_dir() && !pattern_has_recursive {
                        // Only walk if pattern didn't already have recursive **
                        Self::walk_directory_shallow(
                            &entry,
                            &mut matched_set,
                            &mut reclaimable_bytes,
                            3, // max depth 3
                        );
                    }
                }
            }
        }

        let mut matched_paths: Vec<PathBuf> = matched_set.into_iter().collect();
        matched_paths.sort();
        let file_count = matched_paths.len();
        let sample_paths = matched_paths.iter().take(5).cloned().collect();

        RuleScanResult {
            rule_id: rule.id.clone(),
            name: rule.name.clone(),
            category: rule.category.clone(),
            risk_tier: rule.risk_tier,
            reclaimable_bytes,
            file_count,
            sample_paths,
            matched_paths,
            running_apps_blocking,
        }
    }

    fn walk_directory_shallow(
        dir: &Path,
        matched: &mut HashSet<PathBuf>,
        bytes: &mut u64,
        depth_remaining: usize,
    ) {
        if depth_remaining == 0 {
            return;
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if ProtectedValidator::validate(&path).is_err() {
                    continue;
                }

                if path.is_file() {
                    if matched.insert(path.clone()) {
                        if let Ok(meta) = fs::symlink_metadata(&path) {
                            *bytes += meta.len();
                        }
                    }
                } else if path.is_dir() {
                    Self::walk_directory_shallow(&path, matched, bytes, depth_remaining - 1);
                }
            }
        }
    }

    fn format_category_title(cat: &str) -> String {
        match cat {
            "browser" => "Web Browsers".into(),
            "system" => "System Caches & Logs".into(),
            "package_cache" => "Package Manager Archives".into(),
            "dev" => "Development Artifacts".into(),
            "app_cache" => "Desktop Application Caches".into(),
            other => {
                let mut c = other.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parallel_scanner_with_temp_files() {
        let temp_dir = std::env::temp_dir().join(format!("atp_scan_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);

        let file1 = temp_dir.join("temp_file_1.cache");
        let file2 = temp_dir.join("temp_file_2.cache");
        fs::write(&file1, b"1234567890").unwrap(); // 10 bytes
        fs::write(&file2, b"abcdefghij12345").unwrap(); // 15 bytes

        let rule = CleanerRule {
            id: "test-temp".into(),
            name: "Test Temp Files".into(),
            category: "system".into(),
            description: "Temporary files".into(),
            paths: vec![format!(
                "{temp_dir_str}/*.cache",
                temp_dir_str = temp_dir.display()
            )],
            requires_closed: vec![],
            risk_tier: 1,
            explanation: "Testing".into(),
        };

        let summary = ParallelScanner::scan_rules(&[rule]);

        assert_eq!(summary.total_file_count, 2);
        assert_eq!(summary.total_reclaimable_bytes, 25);
        assert_eq!(summary.categories.len(), 1);
        assert_eq!(summary.categories[0].category_id, "system");
        assert!(!summary.blocked_by_running_apps);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detects_running_process_lock() {
        let running = ParallelScanner::get_running_process_names();
        assert!(
            !running.is_empty(),
            "Must detect at least one running process on Linux"
        );
        let sample_running = running.iter().next().unwrap().clone();

        let rule = CleanerRule {
            id: "test-lock".into(),
            name: "Test Lock".into(),
            category: "dev".into(),
            description: "Testing app lock".into(),
            paths: vec!["/tmp/non_existent_path_xyz/**".into()],
            requires_closed: vec![sample_running.clone()],
            risk_tier: 2,
            explanation: "Testing".into(),
        };

        let summary = ParallelScanner::scan_rules(&[rule]);
        assert!(
            summary.blocked_by_running_apps,
            "Should detect running process: {}",
            sample_running
        );
    }

    #[test]
    fn test_scan_all_discovered_rules_performance() {
        use crate::rule::RuleEngine;
        let engine = RuleEngine::discover_and_load().expect("Discover must succeed");
        let start = std::time::Instant::now();
        let summary = ParallelScanner::scan_rules(engine.rules());
        let elapsed = start.elapsed();

        assert!(
            elapsed.as_millis() < 2500,
            "Scanning must finish under 2.5s, took {:?}",
            elapsed
        );
        assert!(!summary.categories.is_empty());
    }
}
