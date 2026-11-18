use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use atp_core::{CoreError, ErrorKind};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantinedFile {
    pub original_path: PathBuf,
    pub relative_path: PathBuf,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineManifest {
    pub session_id: String,
    pub created_at: i64,
    pub rule_ids: Vec<String>,
    pub total_bytes: u64,
    pub files: Vec<QuarantinedFile>,
}

pub struct QuarantineStore {
    base_dir: PathBuf,
}

impl QuarantineStore {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub fn session_path(&self, session_id: &str) -> PathBuf {
        self.base_dir.join(session_id)
    }

    pub fn manifest_path(&self, session_id: &str) -> PathBuf {
        self.session_path(session_id).join("manifest.json")
    }

    pub fn read_manifest(&self, session_id: &str) -> Result<QuarantineManifest, CoreError> {
        let manifest_file = self.manifest_path(session_id);
        if !manifest_file.exists() {
            return Err(CoreError::new(
                ErrorKind::Cleaner,
                "cleaner.session_not_found",
                false,
                format!("Quarantine session '{session_id}' does not exist."),
                None,
            ));
        }

        let content = std::fs::read_to_string(&manifest_file).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "cleaner.manifest_read_failed",
                false,
                format!("Failed to read quarantine manifest: {e}"),
                None,
            )
        })?;

        serde_json::from_str(&content).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "cleaner.manifest_corrupted",
                false,
                format!("Failed to deserialize quarantine manifest: {e}"),
                None,
            )
        })
    }
}
