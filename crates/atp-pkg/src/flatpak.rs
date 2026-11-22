use async_trait::async_trait;
use atp_core::{CoreError, ErrorKind, RiskTier};
use crate::backend::{PackageBackend, PackageInfo, PackagePlan, PackageUpdate};
use crate::detector::HostSystemProfile;

pub struct FlatpakBackend;

impl Default for FlatpakBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl FlatpakBackend {
    pub fn new() -> Self {
        Self
    }

    pub fn parse_size_string(size_str: &str) -> Option<u64> {
        let trimmed = size_str.trim();
        if trimmed.is_empty() {
            return None;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.is_empty() {
            return None;
        }

        let num: f64 = parts[0].replace(',', ".").parse().ok()?;
        let unit = parts.get(1).map(|s| s.to_uppercase()).unwrap_or_default();

        let multiplier: f64 = match unit.as_str() {
            "BYTES" | "B" => 1.0,
            "KB" | "KIB" => 1024.0,
            "MB" | "MIB" => 1024.0 * 1024.0,
            "GB" | "GIB" => 1024.0 * 1024.0 * 1024.0,
            _ => 1024.0 * 1024.0,
        };

        Some((num * multiplier) as u64)
    }
}

#[async_trait]
impl PackageBackend for FlatpakBackend {
    fn id(&self) -> &'static str {
        "flatpak"
    }

    fn display_name(&self) -> &'static str {
        "Flatpak"
    }

    fn is_available(&self) -> bool {
        HostSystemProfile::detect_binary("flatpak")
    }

    async fn search(&self, query: &str) -> Result<Vec<PackageInfo>, CoreError> {
        if !self.is_available() {
            return Ok(Vec::new());
        }

        let output = tokio::process::Command::new("flatpak")
            .args(["search", query, "--columns=application,name,version,description"])
            .output()
            .await
            .map_err(|e| {
                CoreError::new(
                    ErrorKind::Pkg,
                    "pkg.flatpak_search_failed",
                    true,
                    format!("Failed to search flatpak packages: {e}"),
                    None,
                )
            })?;

        let mut results = Vec::new();
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines().skip(1) {
                let parts: Vec<&str> = line.split('\t').collect();
                if !parts.is_empty() && !parts[0].trim().is_empty() {
                    let id = parts[0].trim().to_string();
                    let name = parts.get(1).map(|s| s.trim()).unwrap_or(&id).to_string();
                    let version = parts.get(2).map(|s| s.trim()).unwrap_or("").to_string();
                    let summary = parts.get(3).map(|s| s.trim()).unwrap_or("").to_string();

                    results.push(PackageInfo {
                        id,
                        name,
                        version,
                        backend: "flatpak".into(),
                        summary,
                        size_bytes: None,
                        is_updatable: false,
                    });
                }
            }
        }

        Ok(results)
    }

    async fn list_installed(&self) -> Result<Vec<PackageInfo>, CoreError> {
        if !self.is_available() {
            return Ok(Vec::new());
        }

        let output = tokio::process::Command::new("flatpak")
            .args(["list", "--app", "--columns=application,name,version,size,description"])
            .output()
            .await
            .map_err(|e| {
                CoreError::new(
                    ErrorKind::Pkg,
                    "pkg.flatpak_list_failed",
                    true,
                    format!("Failed to list installed flatpaks: {e}"),
                    None,
                )
            })?;

        let mut packages = Vec::new();
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if !parts.is_empty() && !parts[0].trim().is_empty() {
                    let id = parts[0].trim().to_string();
                    let name = parts.get(1).map(|s| s.trim()).unwrap_or(&id).to_string();
                    let version = parts.get(2).map(|s| s.trim()).unwrap_or("").to_string();
                    let size_str = parts.get(3).map(|s| s.trim()).unwrap_or("");
                    let summary = parts.get(4).map(|s| s.trim()).unwrap_or("").to_string();

                    let size_bytes = Self::parse_size_string(size_str);

                    packages.push(PackageInfo {
                        id,
                        name,
                        version,
                        backend: "flatpak".into(),
                        summary,
                        size_bytes,
                        is_updatable: false,
                    });
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self) -> Result<Vec<PackageUpdate>, CoreError> {
        if !self.is_available() {
            return Ok(Vec::new());
        }

        let output = tokio::process::Command::new("flatpak")
            .args(["remote-ls", "--updates", "--columns=application,name,version"])
            .output()
            .await
            .map_err(|e| {
                CoreError::new(
                    ErrorKind::Pkg,
                    "pkg.flatpak_updates_failed",
                    true,
                    format!("Failed checking flatpak updates: {e}"),
                    None,
                )
            })?;

        let mut updates = Vec::new();
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if !parts.is_empty() && !parts[0].trim().is_empty() {
                    let package_id = parts[0].trim().to_string();
                    let version = parts.get(2).map(|s| s.trim()).unwrap_or("").to_string();

                    updates.push(PackageUpdate {
                        package_id,
                        current_version: "installed".into(),
                        new_version: version,
                        backend: "flatpak".into(),
                        download_size_bytes: None,
                    });
                }
            }
        }

        Ok(updates)
    }

    async fn audit_orphans(&self) -> Result<Vec<PackageInfo>, CoreError> {
        if !self.is_available() {
            return Ok(Vec::new());
        }

        // Query unreferenced / unused Flatpak runtimes
        let output = tokio::process::Command::new("flatpak")
            .args(["uninstall", "--unused", "--dry-run"])
            .output()
            .await;

        let mut orphans = Vec::new();

        if let Ok(out) = output {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    let trimmed = line.trim();
                    // Lines typically look like: "1.  org.gnome.Platform/x86_64/45"
                    if trimmed.starts_with(|c: char| c.is_ascii_digit()) && trimmed.contains('/') {
                        let parts: Vec<&str> = trimmed.split_whitespace().collect();
                        if let Some(target) = parts.get(1) {
                            orphans.push(PackageInfo {
                                id: target.to_string(),
                                name: target.to_string(),
                                version: "unused".into(),
                                backend: "flatpak".into(),
                                summary: "Unused Flatpak runtime (no installed applications depend on this)".into(),
                                size_bytes: Some(650 * 1024 * 1024), // Approx 650MB typical runtime
                                is_updatable: false,
                            });
                        }
                    }
                }
            }
        }

        Ok(orphans)
    }

    async fn prepare_install(&self, package_id: &str) -> Result<PackagePlan, CoreError> {
        let plan_id = format!("pkg_plan_install_{}", fastrand::u32(..));
        Ok(PackagePlan {
            plan_id,
            action_type: "install".into(),
            risk_tier: RiskTier::Tier2Reversible,
            target_package: package_id.to_string(),
            affected_packages: vec![package_id.to_string()],
            download_bytes: 150_000_000,
            disk_delta_bytes: 350_000_000,
            requires_polkit: false,
        })
    }

    async fn prepare_remove(&self, package_id: &str) -> Result<PackagePlan, CoreError> {
        let plan_id = format!("pkg_plan_remove_{}", fastrand::u32(..));
        Ok(PackagePlan {
            plan_id,
            action_type: "remove".into(),
            risk_tier: RiskTier::Tier3Destructive,
            target_package: package_id.to_string(),
            affected_packages: vec![package_id.to_string()],
            download_bytes: 0,
            disk_delta_bytes: -350_000_000,
            requires_polkit: false,
        })
    }

    async fn prepare_orphan_purge(&self) -> Result<PackagePlan, CoreError> {
        let orphans = self.audit_orphans().await?;
        let affected: Vec<String> = orphans.into_iter().map(|o| o.id).collect();
        let plan_id = format!("pkg_plan_purge_{}", fastrand::u32(..));

        Ok(PackagePlan {
            plan_id,
            action_type: "purge_orphans".into(),
            risk_tier: RiskTier::Tier3Destructive,
            target_package: "flatpak_unused_runtimes".into(),
            affected_packages: affected,
            download_bytes: 0,
            disk_delta_bytes: -800_000_000,
            requires_polkit: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_size_string() {
        assert_eq!(FlatpakBackend::parse_size_string("1.2 GB"), Some(1288490188));
        assert_eq!(FlatpakBackend::parse_size_string("500 MB"), Some(524288000));
        assert_eq!(FlatpakBackend::parse_size_string("2048 KB"), Some(2097152));
        assert_eq!(FlatpakBackend::parse_size_string(""), None);
    }

    #[tokio::test]
    async fn test_flatpak_backend_metadata() {
        let backend = FlatpakBackend::new();
        assert_eq!(backend.id(), "flatpak");
        assert_eq!(backend.display_name(), "Flatpak");

        let plan = backend.prepare_remove("org.test.App").await.unwrap();
        assert_eq!(plan.action_type, "remove");
        assert_eq!(plan.risk_tier, RiskTier::Tier3Destructive);
        assert!(!plan.requires_polkit);
    }
}
