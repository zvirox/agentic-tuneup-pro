use async_trait::async_trait;
use atp_core::{CoreError, ErrorKind, RiskTier};
use crate::backend::{PackageBackend, PackageInfo, PackagePlan, PackageUpdate};
use crate::detector::{DistroFamily, HostSystemProfile};

pub struct NativeBackend {
    family: DistroFamily,
    display_name: &'static str,
}

impl Default for NativeBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl NativeBackend {
    pub fn new() -> Self {
        let profile = HostSystemProfile::detect();
        let display_name = match profile.distro {
            DistroFamily::Arch => "Arch (pacman)",
            DistroFamily::Debian => "Debian/Ubuntu (apt)",
            DistroFamily::Fedora => "Fedora (dnf)",
            DistroFamily::Unknown => "Native Package Manager",
        };

        Self {
            family: profile.distro,
            display_name,
        }
    }

    pub fn with_family(family: DistroFamily) -> Self {
        let display_name = match family {
            DistroFamily::Arch => "Arch (pacman)",
            DistroFamily::Debian => "Debian/Ubuntu (apt)",
            DistroFamily::Fedora => "Fedora (dnf)",
            DistroFamily::Unknown => "Native Package Manager",
        };

        Self {
            family,
            display_name,
        }
    }
}

#[async_trait]
impl PackageBackend for NativeBackend {
    fn id(&self) -> &'static str {
        "native"
    }

    fn display_name(&self) -> &'static str {
        self.display_name
    }

    fn is_available(&self) -> bool {
        match self.family {
            DistroFamily::Arch => HostSystemProfile::detect_binary("pacman"),
            DistroFamily::Debian => HostSystemProfile::detect_binary("dpkg-query"),
            DistroFamily::Fedora => HostSystemProfile::detect_binary("rpm"),
            DistroFamily::Unknown => false,
        }
    }

    async fn search(&self, query: &str) -> Result<Vec<PackageInfo>, CoreError> {
        let all = self.list_installed().await?;
        let q = query.to_lowercase();
        Ok(all.into_iter().filter(|p| p.name.to_lowercase().contains(&q) || p.id.to_lowercase().contains(&q)).collect())
    }

    async fn list_installed(&self) -> Result<Vec<PackageInfo>, CoreError> {
        if !self.is_available() {
            return Ok(Vec::new());
        }

        match self.family {
            DistroFamily::Arch => self.list_arch_installed().await,
            DistroFamily::Debian => self.list_debian_installed().await,
            DistroFamily::Fedora => self.list_fedora_installed().await,
            DistroFamily::Unknown => Ok(Vec::new()),
        }
    }

    async fn check_updates(&self) -> Result<Vec<PackageUpdate>, CoreError> {
        if !self.is_available() {
            return Ok(Vec::new());
        }

        match self.family {
            DistroFamily::Arch => self.check_arch_updates().await,
            DistroFamily::Debian => self.check_debian_updates().await,
            DistroFamily::Fedora => self.check_fedora_updates().await,
            DistroFamily::Unknown => Ok(Vec::new()),
        }
    }

    async fn audit_orphans(&self) -> Result<Vec<PackageInfo>, CoreError> {
        if !self.is_available() {
            return Ok(Vec::new());
        }

        match self.family {
            DistroFamily::Arch => self.audit_arch_orphans().await,
            DistroFamily::Debian => self.audit_debian_orphans().await,
            DistroFamily::Fedora => self.audit_fedora_orphans().await,
            DistroFamily::Unknown => Ok(Vec::new()),
        }
    }

    async fn prepare_install(&self, package_id: &str) -> Result<PackagePlan, CoreError> {
        let plan_id = format!("pkg_plan_native_install_{}", fastrand::u32(..));
        Ok(PackagePlan {
            plan_id,
            action_type: "install".into(),
            risk_tier: RiskTier::Tier2Reversible,
            target_package: package_id.to_string(),
            affected_packages: vec![package_id.to_string()],
            download_bytes: 25_000_000,
            disk_delta_bytes: 75_000_000,
            requires_polkit: true,
        })
    }

    async fn prepare_remove(&self, package_id: &str) -> Result<PackagePlan, CoreError> {
        let plan_id = format!("pkg_plan_native_remove_{}", fastrand::u32(..));
        Ok(PackagePlan {
            plan_id,
            action_type: "remove".into(),
            risk_tier: RiskTier::Tier3Destructive,
            target_package: package_id.to_string(),
            affected_packages: vec![package_id.to_string()],
            download_bytes: 0,
            disk_delta_bytes: -75_000_000,
            requires_polkit: true,
        })
    }

    async fn prepare_orphan_purge(&self) -> Result<PackagePlan, CoreError> {
        let orphans = self.audit_orphans().await?;
        let affected: Vec<String> = orphans.into_iter().map(|o| o.id).collect();
        let plan_id = format!("pkg_plan_native_purge_{}", fastrand::u32(..));

        Ok(PackagePlan {
            plan_id,
            action_type: "purge_orphans".into(),
            risk_tier: RiskTier::Tier3Destructive,
            target_package: "native_orphaned_packages".into(),
            affected_packages: affected,
            download_bytes: 0,
            disk_delta_bytes: -250_000_000,
            requires_polkit: true,
        })
    }
}

impl NativeBackend {
    async fn list_arch_installed(&self) -> Result<Vec<PackageInfo>, CoreError> {
        let output = tokio::process::Command::new("pacman")
            .args(["-Qe"])
            .output()
            .await
            .map_err(|e| {
                CoreError::new(
                    ErrorKind::Pkg,
                    "pkg.pacman_list_failed",
                    true,
                    format!("Failed executing pacman -Qe: {e}"),
                    None,
                )
            })?;

        let mut list = Vec::new();
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let id = parts[0].to_string();
                    let version = parts[1].to_string();
                    list.push(PackageInfo {
                        id: id.clone(),
                        name: id,
                        version,
                        backend: "pacman".into(),
                        summary: "Explicitly installed native package".into(),
                        size_bytes: None,
                        is_updatable: false,
                    });
                }
            }
        }
        Ok(list)
    }

    async fn check_arch_updates(&self) -> Result<Vec<PackageUpdate>, CoreError> {
        let output = tokio::process::Command::new("pacman")
            .args(["-Qu"])
            .output()
            .await;

        let mut updates = Vec::new();
        if let Ok(out) = output {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        let id = parts[0].to_string();
                        let cur_ver = parts[1].to_string();
                        let new_ver = parts[3].to_string();
                        updates.push(PackageUpdate {
                            package_id: id,
                            current_version: cur_ver,
                            new_version: new_ver,
                            backend: "pacman".into(),
                            download_size_bytes: None,
                        });
                    }
                }
            }
        }
        Ok(updates)
    }

    async fn audit_arch_orphans(&self) -> Result<Vec<PackageInfo>, CoreError> {
        let output = tokio::process::Command::new("pacman")
            .args(["-Qtdq"])
            .output()
            .await;

        let mut orphans = Vec::new();
        if let Ok(out) = output {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    let pkg = line.trim();
                    if !pkg.is_empty() {
                        orphans.push(PackageInfo {
                            id: pkg.to_string(),
                            name: pkg.to_string(),
                            version: "orphan".into(),
                            backend: "pacman".into(),
                            summary: "Unused native dependency (0 reverse dependencies)".into(),
                            size_bytes: Some(15 * 1024 * 1024),
                            is_updatable: false,
                        });
                    }
                }
            }
        }
        Ok(orphans)
    }

    async fn list_debian_installed(&self) -> Result<Vec<PackageInfo>, CoreError> {
        let output = tokio::process::Command::new("dpkg-query")
            .args(["-W", "-f=${Package}\t${Version}\t${Installed-Size}\t${binary:Summary}\n"])
            .output()
            .await
            .map_err(|e| {
                CoreError::new(
                    ErrorKind::Pkg,
                    "pkg.dpkg_list_failed",
                    true,
                    format!("Failed executing dpkg-query: {e}"),
                    None,
                )
            })?;

        let mut list = Vec::new();
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 && !parts[0].trim().is_empty() {
                    let id = parts[0].trim().to_string();
                    let version = parts[1].trim().to_string();
                    let size_kb: u64 = parts.get(2).and_then(|s| s.trim().parse().ok()).unwrap_or(0);
                    let summary = parts.get(3).map(|s| s.trim()).unwrap_or("Native Debian package").to_string();

                    list.push(PackageInfo {
                        id: id.clone(),
                        name: id,
                        version,
                        backend: "apt".into(),
                        summary,
                        size_bytes: if size_kb > 0 { Some(size_kb * 1024) } else { None },
                        is_updatable: false,
                    });
                }
            }
        }
        Ok(list)
    }

    async fn check_debian_updates(&self) -> Result<Vec<PackageUpdate>, CoreError> {
        let output = tokio::process::Command::new("apt")
            .args(["list", "--upgradable"])
            .output()
            .await;

        let mut updates = Vec::new();
        if let Ok(out) = output {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines().skip(1) {
                    if let Some((pkg_part, rest)) = line.split_once('/') {
                        let id = pkg_part.trim().to_string();
                        let parts: Vec<&str> = rest.split_whitespace().collect();
                        let new_ver = parts.get(1).unwrap_or(&"").to_string();
                        updates.push(PackageUpdate {
                            package_id: id,
                            current_version: "installed".into(),
                            new_version: new_ver,
                            backend: "apt".into(),
                            download_size_bytes: None,
                        });
                    }
                }
            }
        }
        Ok(updates)
    }

    async fn audit_debian_orphans(&self) -> Result<Vec<PackageInfo>, CoreError> {
        let output = tokio::process::Command::new("apt-get")
            .args(["autoremove", "--dry-run"])
            .output()
            .await;

        let mut orphans = Vec::new();
        if let Ok(out) = output {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                let mut in_removable = false;
                for line in text.lines() {
                    if line.starts_with("The following packages will be REMOVED:") {
                        in_removable = true;
                        continue;
                    }
                    if in_removable {
                        if line.starts_with(|c: char| !c.is_whitespace()) {
                            break;
                        }
                        for pkg in line.split_whitespace() {
                            orphans.push(PackageInfo {
                                id: pkg.to_string(),
                                name: pkg.to_string(),
                                version: "orphan".into(),
                                backend: "apt".into(),
                                summary: "Orphaned package with 0 reverse dependencies".into(),
                                size_bytes: Some(12 * 1024 * 1024),
                                is_updatable: false,
                            });
                        }
                    }
                }
            }
        }
        Ok(orphans)
    }

    async fn list_fedora_installed(&self) -> Result<Vec<PackageInfo>, CoreError> {
        let output = tokio::process::Command::new("rpm")
            .args(["-qa", "--qf", "%{NAME}\t%{VERSION}\t%{SIZE}\t%{SUMMARY}\n"])
            .output()
            .await
            .map_err(|e| {
                CoreError::new(
                    ErrorKind::Pkg,
                    "pkg.rpm_list_failed",
                    true,
                    format!("Failed executing rpm: {e}"),
                    None,
                )
            })?;

        let mut list = Vec::new();
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 && !parts[0].trim().is_empty() {
                    let id = parts[0].trim().to_string();
                    let version = parts[1].trim().to_string();
                    let size: u64 = parts.get(2).and_then(|s| s.trim().parse().ok()).unwrap_or(0);
                    let summary = parts.get(3).map(|s| s.trim()).unwrap_or("").to_string();

                    list.push(PackageInfo {
                        id: id.clone(),
                        name: id,
                        version,
                        backend: "dnf".into(),
                        summary,
                        size_bytes: if size > 0 { Some(size) } else { None },
                        is_updatable: false,
                    });
                }
            }
        }
        Ok(list)
    }

    async fn check_fedora_updates(&self) -> Result<Vec<PackageUpdate>, CoreError> {
        let output = tokio::process::Command::new("dnf")
            .args(["check-update", "-q"])
            .output()
            .await;

        let mut updates = Vec::new();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    updates.push(PackageUpdate {
                        package_id: parts[0].to_string(),
                        current_version: "installed".into(),
                        new_version: parts[1].to_string(),
                        backend: "dnf".into(),
                        download_size_bytes: None,
                    });
                }
            }
        }
        Ok(updates)
    }

    async fn audit_fedora_orphans(&self) -> Result<Vec<PackageInfo>, CoreError> {
        let output = tokio::process::Command::new("dnf")
            .args(["repoquery", "--unneeded"])
            .output()
            .await;

        let mut orphans = Vec::new();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                let pkg = line.trim();
                if !pkg.is_empty() {
                    orphans.push(PackageInfo {
                        id: pkg.to_string(),
                        name: pkg.to_string(),
                        version: "unneeded".into(),
                        backend: "dnf".into(),
                        summary: "Unneeded dependency package".into(),
                        size_bytes: Some(15 * 1024 * 1024),
                        is_updatable: false,
                    });
                }
            }
        }
        Ok(orphans)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_native_backend_instantiation() {
        let backend = NativeBackend::with_family(DistroFamily::Arch);
        assert_eq!(backend.id(), "native");
        assert_eq!(backend.display_name(), "Arch (pacman)");

        let plan = backend.prepare_remove("ripgrep").await.unwrap();
        assert_eq!(plan.action_type, "remove");
        assert_eq!(plan.risk_tier, RiskTier::Tier3Destructive);
        assert!(plan.requires_polkit);
    }
}
