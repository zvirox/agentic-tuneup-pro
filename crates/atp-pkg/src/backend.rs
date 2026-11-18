use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use atp_core::{CoreError, RiskTier};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub backend: String,
    pub summary: String,
    pub size_bytes: Option<u64>,
    pub is_updatable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageUpdate {
    pub package_id: String,
    pub current_version: String,
    pub new_version: String,
    pub backend: String,
    pub download_size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackagePlan {
    pub plan_id: String,
    pub action_type: String,
    pub risk_tier: RiskTier,
    pub target_package: String,
    pub affected_packages: Vec<String>,
    pub download_bytes: u64,
    pub disk_delta_bytes: i64,
    pub requires_polkit: bool,
}

#[async_trait]
pub trait PackageBackend: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn is_available(&self) -> bool;
    async fn search(&self, query: &str) -> Result<Vec<PackageInfo>, CoreError>;
    async fn list_installed(&self) -> Result<Vec<PackageInfo>, CoreError>;
    async fn check_updates(&self) -> Result<Vec<PackageUpdate>, CoreError>;
    async fn audit_orphans(&self) -> Result<Vec<PackageInfo>, CoreError>;
    async fn prepare_install(&self, package_id: &str) -> Result<PackagePlan, CoreError>;
    async fn prepare_remove(&self, package_id: &str) -> Result<PackagePlan, CoreError>;
    async fn prepare_orphan_purge(&self) -> Result<PackagePlan, CoreError>;
}
