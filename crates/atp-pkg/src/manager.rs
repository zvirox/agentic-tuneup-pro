use atp_core::{CoreError, ErrorKind};
use crate::appimage::AppImageBackend;
use crate::backend::{PackageBackend, PackageInfo, PackagePlan, PackageUpdate};
use crate::flatpak::FlatpakBackend;
use crate::native::NativeBackend;

pub struct PackageManagerManager {
    backends: Vec<Box<dyn PackageBackend>>,
}

impl Default for PackageManagerManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PackageManagerManager {
    pub fn new() -> Self {
        let mut backends: Vec<Box<dyn PackageBackend>> = Vec::new();

        let flatpak = FlatpakBackend::new();
        if flatpak.is_available() {
            backends.push(Box::new(flatpak));
        }

        let native = NativeBackend::new();
        if native.is_available() {
            backends.push(Box::new(native));
        }

        let appimage = AppImageBackend::new();
        if appimage.is_available() {
            backends.push(Box::new(appimage));
        }

        Self { backends }
    }

    pub fn with_backends(backends: Vec<Box<dyn PackageBackend>>) -> Self {
        Self { backends }
    }

    pub fn backends(&self) -> &[Box<dyn PackageBackend>] {
        &self.backends
    }

    pub async fn list_all_installed(&self, backend_filter: Option<&str>) -> Result<Vec<PackageInfo>, CoreError> {
        let mut all_packages = Vec::new();

        for backend in &self.backends {
            if let Some(filter) = backend_filter {
                if backend.id() != filter {
                    continue;
                }
            }
            if let Ok(packages) = backend.list_installed().await {
                all_packages.extend(packages);
            }
        }

        Ok(all_packages)
    }

    pub async fn check_all_updates(&self) -> Result<Vec<PackageUpdate>, CoreError> {
        let mut all_updates = Vec::new();

        for backend in &self.backends {
            if let Ok(updates) = backend.check_updates().await {
                all_updates.extend(updates);
            }
        }

        Ok(all_updates)
    }

    pub async fn audit_all_orphans(&self) -> Result<Vec<PackageInfo>, CoreError> {
        let mut all_orphans = Vec::new();

        for backend in &self.backends {
            if let Ok(orphans) = backend.audit_orphans().await {
                all_orphans.extend(orphans);
            }
        }

        Ok(all_orphans)
    }

    pub async fn prepare_action(
        &self,
        action_type: &str,
        backend_id: &str,
        package_id: &str,
    ) -> Result<PackagePlan, CoreError> {
        let backend = self
            .backends
            .iter()
            .find(|b| b.id() == backend_id)
            .ok_or_else(|| {
                CoreError::new(
                    ErrorKind::Pkg,
                    "pkg.backend_not_found",
                    false,
                    format!("Package backend '{backend_id}' is not available on this host."),
                    Some(serde_json::json!({ "backend": backend_id })),
                )
            })?;

        match action_type {
            "install" => backend.prepare_install(package_id).await,
            "remove" => backend.prepare_remove(package_id).await,
            "purge_orphans" => backend.prepare_orphan_purge().await,
            _ => Err(CoreError::new(
                ErrorKind::Pkg,
                "pkg.invalid_action",
                false,
                format!("Invalid package action type '{action_type}'"),
                None,
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_manager_instantiation() {
        let manager = PackageManagerManager::new();
        let _ = manager.list_all_installed(None).await;
    }
}
