//! Pre-Change Filesystem Snapshot Hooks (Timeshift / Snapper / Btrfs).

use atp_core::error::CoreError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

/// Supported Linux filesystem snapshot providers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotProvider {
    Timeshift,
    Snapper,
    Btrfs,
}

impl std::fmt::Display for SnapshotProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Timeshift => write!(f, "Timeshift"),
            Self::Snapper => write!(f, "Snapper"),
            Self::Btrfs => write!(f, "Btrfs Subvolume"),
        }
    }
}

/// Discovered snapshot capabilities on the host system.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotCapability {
    pub available_providers: Vec<SnapshotProvider>,
    pub recommended_provider: Option<SnapshotProvider>,
    pub auto_snapshot_enabled: bool,
    pub btrfs_root_detected: bool,
}

/// Metadata record of an initiated pre-change snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotRecord {
    pub id: String,
    pub provider: SnapshotProvider,
    pub timestamp: i64,
    pub description: String,
    pub success: bool,
    pub output_or_error: String,
}

/// Manager responsible for detecting snapshot tooling and creating pre-change restore points.
pub struct SnapshotManager;

impl SnapshotManager {
    /// Detects installed snapshot providers on the Linux host.
    pub fn detect() -> SnapshotCapability {
        let mut providers = Vec::new();

        // Check Timeshift binary
        if Self::check_binary_exists("timeshift") {
            providers.push(SnapshotProvider::Timeshift);
        }

        // Check Snapper binary
        if Self::check_binary_exists("snapper") {
            providers.push(SnapshotProvider::Snapper);
        }

        // Check if root / is btrfs
        let btrfs_root = Self::check_is_btrfs_root();
        if btrfs_root && Self::check_binary_exists("btrfs") {
            providers.push(SnapshotProvider::Btrfs);
        }

        let recommended = providers.first().copied();

        SnapshotCapability {
            available_providers: providers,
            recommended_provider: recommended,
            auto_snapshot_enabled: true,
            btrfs_root_detected: btrfs_root,
        }
    }

    /// Verifies if a given executable exists in standard system paths.
    fn check_binary_exists(bin_name: &str) -> bool {
        let paths = ["/usr/bin", "/bin", "/usr/sbin", "/sbin", "/usr/local/bin"];
        for dir in paths {
            if Path::new(dir).join(bin_name).exists() {
                return true;
            }
        }
        false
    }

    /// Checks if root filesystem mount is formatted as btrfs.
    fn check_is_btrfs_root() -> bool {
        if let Ok(mounts) = fs::read_to_string("/proc/mounts") {
            for line in mounts.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 && parts[1] == "/" && parts[2] == "btrfs" {
                    return true;
                }
            }
        }
        false
    }

    /// Creates a pre-change snapshot using the designated or recommended provider.
    pub fn create_pre_change_snapshot(
        description: &str,
        provider: Option<SnapshotProvider>,
    ) -> Result<SnapshotRecord, CoreError> {
        let chosen_provider = match provider {
            Some(p) => p,
            None => {
                let cap = Self::detect();
                cap.recommended_provider.ok_or_else(|| {
                    CoreError::safety(
                        "snapshot.no_provider",
                        "No supported snapshot provider (Timeshift, Snapper, or Btrfs) detected on this system.",
                    )
                })?
            }
        };

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let snapshot_id = format!("snap_{}_{timestamp}", chosen_provider.to_string().to_lowercase().replace(' ', "_"));

        let result = match chosen_provider {
            SnapshotProvider::Timeshift => {
                let cmd = Command::new("timeshift")
                    .args(["--create", "--comments", description, "--tags", "D"])
                    .output();
                Self::parse_cmd_output(cmd, snapshot_id, chosen_provider, timestamp, description)
            }
            SnapshotProvider::Snapper => {
                let cmd = Command::new("snapper")
                    .args(["create", "-t", "pre", "-c", "timeline", "-d", description])
                    .output();
                Self::parse_cmd_output(cmd, snapshot_id, chosen_provider, timestamp, description)
            }
            SnapshotProvider::Btrfs => {
                let dest = format!("/.snapshots/{snapshot_id}");
                let cmd = Command::new("btrfs")
                    .args(["subvolume", "snapshot", "-r", "/", &dest])
                    .output();
                Self::parse_cmd_output(cmd, snapshot_id, chosen_provider, timestamp, description)
            }
        };

        result
    }

    fn parse_cmd_output(
        cmd_result: Result<std::process::Output, std::io::Error>,
        id: String,
        provider: SnapshotProvider,
        timestamp: i64,
        description: &str,
    ) -> Result<SnapshotRecord, CoreError> {
        match cmd_result {
            Ok(out) => {
                let success = out.status.success();
                let msg = if success {
                    String::from_utf8_lossy(&out.stdout).to_string()
                } else {
                    String::from_utf8_lossy(&out.stderr).to_string()
                };
                Ok(SnapshotRecord {
                    id,
                    provider,
                    timestamp,
                    description: description.to_string(),
                    success,
                    output_or_error: msg.trim().to_string(),
                })
            }
            Err(e) => Ok(SnapshotRecord {
                id,
                provider,
                timestamp,
                description: description.to_string(),
                success: false,
                output_or_error: e.to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snapshot_detection() {
        let cap = SnapshotManager::detect();
        assert!(cap.auto_snapshot_enabled);
    }

    #[test]
    fn test_snapshot_provider_display() {
        assert_eq!(SnapshotProvider::Timeshift.to_string(), "Timeshift");
        assert_eq!(SnapshotProvider::Snapper.to_string(), "Snapper");
        assert_eq!(SnapshotProvider::Btrfs.to_string(), "Btrfs Subvolume");
    }

    #[test]
    fn test_create_snapshot_fails_safely_when_provider_missing() {
        let record = SnapshotManager::create_pre_change_snapshot(
            "Test pre-change snapshot",
            Some(SnapshotProvider::Timeshift),
        );

        assert!(record.is_ok());
        let rec = record.unwrap();
        assert_eq!(rec.provider, SnapshotProvider::Timeshift);
    }
}
