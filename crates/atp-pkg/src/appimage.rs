use std::fs;
use std::path::{Path, PathBuf};
use async_trait::async_trait;
use atp_core::{CoreError, RiskTier};
use crate::backend::{PackageBackend, PackageInfo, PackagePlan, PackageUpdate};

pub struct AppImageBackend;

impl Default for AppImageBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl AppImageBackend {
    pub fn new() -> Self {
        Self
    }

    pub fn scan_directories() -> Vec<PathBuf> {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        vec![
            PathBuf::from(&home).join("Applications"),
            PathBuf::from(&home).join(".local/bin"),
            PathBuf::from("/opt"),
        ]
    }

    pub fn is_appimage_file(path: &Path) -> bool {
        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            ext.eq_ignore_ascii_case("appimage")
        } else {
            false
        }
    }
}

#[async_trait]
impl PackageBackend for AppImageBackend {
    fn id(&self) -> &'static str {
        "appimage"
    }

    fn display_name(&self) -> &'static str {
        "AppImage"
    }

    fn is_available(&self) -> bool {
        Self::scan_directories().iter().any(|d| d.exists())
    }

    async fn search(&self, query: &str) -> Result<Vec<PackageInfo>, CoreError> {
        let all = self.list_installed().await?;
        let q = query.to_lowercase();
        Ok(all.into_iter().filter(|p| p.name.to_lowercase().contains(&q) || p.id.to_lowercase().contains(&q)).collect())
    }

    async fn list_installed(&self) -> Result<Vec<PackageInfo>, CoreError> {
        let mut packages = Vec::new();

        for dir in Self::scan_directories() {
            if !dir.exists() || !dir.is_dir() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && Self::is_appimage_file(&path) {
                        let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("appimage");
                        let meta = fs::metadata(&path).ok();
                        let size = meta.map(|m| m.len());

                        let clean_name = file_name
                            .trim_end_matches(".AppImage")
                            .trim_end_matches(".appimage")
                            .replace('-', " ")
                            .replace('_', " ");

                        packages.push(PackageInfo {
                            id: path.to_string_lossy().to_string(),
                            name: clean_name,
                            version: "standalone".into(),
                            backend: "appimage".into(),
                            summary: format!("Standalone Linux AppImage binary ({})", path.display()),
                            size_bytes: size,
                            is_updatable: false,
                        });
                    }
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self) -> Result<Vec<PackageUpdate>, CoreError> {
        // AppImage updates require zsync or AppImageUpdate metadata
        Ok(Vec::new())
    }

    async fn audit_orphans(&self) -> Result<Vec<PackageInfo>, CoreError> {
        // Check for orphaned desktop entries in ~/.local/share/applications whose AppImage target is gone
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let apps_dir = PathBuf::from(home).join(".local/share/applications");
        let mut orphans = Vec::new();

        if apps_dir.exists() {
            if let Ok(entries) = fs::read_dir(apps_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.extension().and_then(|s| s.to_str()) == Some("desktop") {
                        if let Ok(content) = fs::read_to_string(&p) {
                            for line in content.lines() {
                                if let Some(exec) = line.strip_prefix("Exec=") {
                                    let target_binary = exec.split_whitespace().next().unwrap_or("");
                                    if target_binary.ends_with(".AppImage") || target_binary.ends_with(".appimage") {
                                        if !Path::new(target_binary).exists() {
                                            orphans.push(PackageInfo {
                                                id: p.to_string_lossy().to_string(),
                                                name: p.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string(),
                                                version: "broken_shortcut".into(),
                                                backend: "appimage".into(),
                                                summary: format!("Orphaned desktop shortcut pointing to missing binary: {target_binary}"),
                                                size_bytes: Some(4096),
                                                is_updatable: false,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(orphans)
    }

    async fn prepare_install(&self, _package_id: &str) -> Result<PackagePlan, CoreError> {
        let plan_id = format!("pkg_plan_install_{}", fastrand::u32(..));
        Ok(PackagePlan {
            plan_id,
            action_type: "install".into(),
            risk_tier: RiskTier::Tier2Reversible,
            target_package: "appimage".into(),
            affected_packages: vec![],
            download_bytes: 0,
            disk_delta_bytes: 0,
            requires_polkit: false,
        })
    }

    async fn prepare_remove(&self, package_id: &str) -> Result<PackagePlan, CoreError> {
        let plan_id = format!("pkg_plan_remove_{}", fastrand::u32(..));
        let path = PathBuf::from(package_id);
        let size = fs::metadata(&path).map(|m| m.len() as i64).unwrap_or(100_000_000);

        Ok(PackagePlan {
            plan_id,
            action_type: "remove".into(),
            risk_tier: RiskTier::Tier3Destructive,
            target_package: package_id.to_string(),
            affected_packages: vec![package_id.to_string()],
            download_bytes: 0,
            disk_delta_bytes: -size,
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
            target_package: "orphaned_appimage_shortcuts".into(),
            affected_packages: affected,
            download_bytes: 0,
            disk_delta_bytes: 0,
            requires_polkit: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_appimage_file() {
        assert!(AppImageBackend::is_appimage_file(Path::new("/tmp/MyApp.AppImage")));
        assert!(AppImageBackend::is_appimage_file(Path::new("tool.appimage")));
        assert!(!AppImageBackend::is_appimage_file(Path::new("archive.tar.gz")));
        assert!(!AppImageBackend::is_appimage_file(Path::new("/usr/bin/python3")));
    }
}
