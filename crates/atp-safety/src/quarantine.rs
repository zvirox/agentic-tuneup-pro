use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use crate::protected::ProtectedValidator;
use atp_core::{CoreError, ErrorKind, ExecutionResult};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuarantinedFile {
    pub original_path: PathBuf,
    pub relative_path: PathBuf,
    pub size_bytes: u64,
    pub sha256: String,
    pub unix_mode: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

    /// Creates the standard QuarantineStore at `$XDG_DATA_HOME/agentic-tuneup-pro/quarantine`.
    pub fn default_store() -> Self {
        let base_data = std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
                PathBuf::from(home).join(".local/share")
            });
        Self::new(base_data.join("agentic-tuneup-pro/quarantine"))
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    pub fn session_path(&self, session_id: &str) -> PathBuf {
        self.base_dir.join(session_id)
    }

    pub fn session_files_dir(&self, session_id: &str) -> PathBuf {
        self.session_path(session_id).join("files")
    }

    pub fn manifest_path(&self, session_id: &str) -> PathBuf {
        self.session_path(session_id).join("manifest.json")
    }

    pub fn read_manifest(&self, session_id: &str) -> Result<QuarantineManifest, CoreError> {
        let manifest_file = self.manifest_path(session_id);
        if !manifest_file.exists() {
            return Err(CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.session_not_found",
                false,
                format!("Quarantine session '{session_id}' does not exist."),
                None,
            ));
        }

        let content = fs::read_to_string(&manifest_file).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.manifest_read_failed",
                false,
                format!("Failed to read quarantine manifest: {e}"),
                None,
            )
        })?;

        serde_json::from_str(&content).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.manifest_corrupted",
                false,
                format!("Failed to parse quarantine manifest: {e}"),
                None,
            )
        })
    }

    /// Stages given files into an isolated quarantine session folder.
    ///
    /// Validates all files against protected paths before any filesystem mutation.
    pub fn stage_files(
        &self,
        session_id: &str,
        rule_ids: &[String],
        targets: &[PathBuf],
    ) -> Result<QuarantineManifest, CoreError> {
        // 1. Pre-validation: verify zero protected targets
        for target in targets {
            ProtectedValidator::validate(target)?;
        }

        let _session_dir = self.session_path(session_id);
        let files_dir = self.session_files_dir(session_id);
        fs::create_dir_all(&files_dir).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.dir_create_failed",
                false,
                format!("Failed to create quarantine directory: {e}"),
                None,
            )
        })?;

        let mut quarantined_files = Vec::new();
        let mut total_bytes = 0u64;

        for (idx, original) in targets.iter().enumerate() {
            if !original.exists() {
                continue;
            }

            match Self::quarantine_single_file(original, idx, &files_dir) {
                Ok(file_info) => {
                    total_bytes += file_info.size_bytes;
                    quarantined_files.push(file_info);
                }
                Err(err) => {
                    eprintln!(
                        "[ATP-Quarantine] Notice: skipped locked or inaccessible file {}: {err}",
                        original.display()
                    );
                }
            }
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let manifest = QuarantineManifest {
            session_id: session_id.to_string(),
            created_at: now,
            rule_ids: rule_ids.to_vec(),
            total_bytes,
            files: quarantined_files,
        };

        Self::write_manifest_atomic(&self.manifest_path(session_id), &manifest)?;
        Ok(manifest)
    }

    fn quarantine_single_file(
        original: &Path,
        index: usize,
        files_dir: &Path,
    ) -> Result<QuarantinedFile, CoreError> {
        let metadata = fs::symlink_metadata(original).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.metadata_failed",
                false,
                format!("Failed reading metadata for {}: {e}", original.display()),
                None,
            )
        })?;

        let size_bytes = metadata.len();
        let sha256 = Self::calculate_sha256(original)?;

        #[cfg(unix)]
        let unix_mode = Some(metadata.permissions().mode());
        #[cfg(not(unix))]
        let unix_mode = None;

        let file_name = original
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| format!("file_{index}"));
        let relative_path = PathBuf::from(format!("{:05}_{file_name}", index));
        let dest_path = files_dir.join(&relative_path);

        Self::move_or_copy(original, &dest_path)?;

        Ok(QuarantinedFile {
            original_path: original.to_path_buf(),
            relative_path,
            size_bytes,
            sha256,
            unix_mode,
        })
    }

    /// Atomically restores all files from a quarantine session back to their original locations.
    pub fn restore_session(&self, session_id: &str) -> Result<ExecutionResult, CoreError> {
        let manifest = self.read_manifest(session_id)?;
        let files_dir = self.session_files_dir(session_id);

        for item in &manifest.files {
            let source_path = files_dir.join(&item.relative_path);
            if !source_path.exists() {
                return Err(CoreError::new(
                    ErrorKind::Cleaner,
                    "quarantine.file_missing",
                    false,
                    format!("Quarantined file missing at {}", source_path.display()),
                    None,
                ));
            }

            // Verify integrity before restoring
            let current_hash = Self::calculate_sha256(&source_path)?;
            if current_hash != item.sha256 {
                return Err(CoreError::new(
                    ErrorKind::Cleaner,
                    "quarantine.integrity_check_failed",
                    false,
                    format!("Checksum mismatch for {}", item.original_path.display()),
                    None,
                ));
            }

            // Ensure destination directory exists
            if let Some(parent) = item.original_path.parent() {
                let _ = fs::create_dir_all(parent);
            }

            Self::move_or_copy(&source_path, &item.original_path)?;

            #[cfg(unix)]
            if let Some(mode) = item.unix_mode {
                let _ = fs::set_permissions(&item.original_path, fs::Permissions::from_mode(mode));
            }
        }

        // Clean up session directory after successful restoration
        let _ = fs::remove_dir_all(self.session_path(session_id));

        Ok(ExecutionResult {
            success: true,
            bytes_reclaimed: 0,
            files_affected: manifest.files.len(),
            undo_session_id: Some(session_id.to_string()),
            summary: format!(
                "Successfully restored {} files ({} bytes) from quarantine session '{}'",
                manifest.files.len(),
                manifest.total_bytes,
                session_id
            ),
        })
    }

    /// Permanently deletes all files in a quarantine session.
    pub fn purge_session(&self, session_id: &str) -> Result<u64, CoreError> {
        let manifest = self.read_manifest(session_id)?;
        let bytes = manifest.total_bytes;
        let session_dir = self.session_path(session_id);

        fs::remove_dir_all(&session_dir).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.purge_failed",
                false,
                format!("Failed to purge quarantine session '{session_id}': {e}"),
                None,
            )
        })?;

        Ok(bytes)
    }

    /// Purges quarantine sessions older than max_age_seconds.
    pub fn purge_expired_sessions(&self, max_age_seconds: i64) -> Result<usize, CoreError> {
        if !self.base_dir.exists() {
            return Ok(0);
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let entries = fs::read_dir(&self.base_dir).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.list_failed",
                false,
                format!("Failed to list quarantine directory: {e}"),
                None,
            )
        })?;

        let mut purged_count = 0;

        for entry in entries.flatten() {
            let session_id = entry.file_name().to_string_lossy().to_string();
            if let Ok(manifest) = self.read_manifest(&session_id) {
                if now - manifest.created_at > max_age_seconds {
                    if self.purge_session(&session_id).is_ok() {
                        purged_count += 1;
                    }
                }
            }
        }

        Ok(purged_count)
    }

    fn calculate_sha256(path: &Path) -> Result<String, CoreError> {
        let mut file = File::open(path).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.read_failed",
                false,
                format!("Failed to open file for SHA-256 calculation: {e}"),
                None,
            )
        })?;

        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 65536];

        loop {
            let bytes_read = file.read(&mut buffer).map_err(|e| {
                CoreError::new(
                    ErrorKind::Cleaner,
                    "quarantine.read_failed",
                    false,
                    format!("Failed reading bytes for checksum: {e}"),
                    None,
                )
            })?;

            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }

        Ok(hex::encode(hasher.finalize()))
    }

    fn move_or_copy(source: &Path, destination: &Path) -> Result<(), CoreError> {
        // Attempt fast atomic rename first
        if fs::rename(source, destination).is_ok() {
            return Ok(());
        }

        // Fallback for cross-device moves
        fs::copy(source, destination).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.move_failed",
                false,
                format!("Failed copying file to destination: {e}"),
                None,
            )
        })?;

        let _ = fs::remove_file(source);
        Ok(())
    }

    fn write_manifest_atomic(
        manifest_path: &Path,
        manifest: &QuarantineManifest,
    ) -> Result<(), CoreError> {
        let serialized = serde_json::to_string_pretty(manifest).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.serialize_failed",
                false,
                format!("Failed to serialize manifest: {e}"),
                None,
            )
        })?;

        let temp_path = manifest_path.with_extension("tmp");
        fs::write(&temp_path, serialized).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.write_manifest_failed",
                false,
                format!("Failed to write manifest temp file: {e}"),
                None,
            )
        })?;

        fs::rename(&temp_path, manifest_path).map_err(|e| {
            CoreError::new(
                ErrorKind::Cleaner,
                "quarantine.rename_manifest_failed",
                false,
                format!("Failed to atomic rename manifest: {e}"),
                None,
            )
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_env(name: &str) -> (PathBuf, PathBuf) {
        let base_tmp = std::env::temp_dir().join(format!("atp_test_{name}_{}", std::process::id()));
        let quarantine_dir = base_tmp.join("quarantine");
        let work_dir = base_tmp.join("work");
        let _ = fs::create_dir_all(&quarantine_dir);
        let _ = fs::create_dir_all(&work_dir);
        (quarantine_dir, work_dir)
    }

    #[test]
    fn test_stage_and_restore_cycle_with_parity() {
        let (quarantine_dir, work_dir) = create_test_env("stage_restore");
        let store = QuarantineStore::new(quarantine_dir.clone());

        // Create 2 sample files
        let file_a = work_dir.join("test_file_a.txt");
        let file_b = work_dir.join("test_file_b.bin");
        fs::write(&file_a, b"Sample text content for undo engine test").unwrap();
        fs::write(&file_b, vec![0xCA, 0xFE, 0xBA, 0xBE, 0x01, 0x02, 0x03]).unwrap();

        let original_hash_a = QuarantineStore::calculate_sha256(&file_a).unwrap();
        let original_hash_b = QuarantineStore::calculate_sha256(&file_b).unwrap();

        let session_id = "session_cycle_1";
        let manifest = store
            .stage_files(
                session_id,
                &["rule.test".to_string()],
                &[file_a.clone(), file_b.clone()],
            )
            .expect("Staging must succeed");

        assert_eq!(manifest.files.len(), 2);
        assert!(!file_a.exists(), "Original file A should have been moved");
        assert!(!file_b.exists(), "Original file B should have been moved");

        // Sub-second undo performance verification (< 200ms)
        let start = std::time::Instant::now();
        let restore_res = store
            .restore_session(session_id)
            .expect("Restore must succeed");
        let elapsed = start.elapsed();
        assert!(
            elapsed.as_millis() < 200,
            "Sub-second undo must finish within 200ms, took {:?}",
            elapsed
        );

        assert!(restore_res.success);
        assert_eq!(restore_res.files_affected, 2);

        assert!(file_a.exists(), "File A must be restored");
        assert!(file_b.exists(), "File B must be restored");

        let restored_hash_a = QuarantineStore::calculate_sha256(&file_a).unwrap();
        let restored_hash_b = QuarantineStore::calculate_sha256(&file_b).unwrap();

        assert_eq!(original_hash_a, restored_hash_a, "Hash parity check file A");
        assert_eq!(original_hash_b, restored_hash_b, "Hash parity check file B");

        // Clean up
        let _ = fs::remove_dir_all(&quarantine_dir);
        let _ = fs::remove_dir_all(&work_dir);
    }

    #[test]
    fn test_stage_refuses_protected_files() {
        let (quarantine_dir, work_dir) = create_test_env("refuse_protected");
        let store = QuarantineStore::new(quarantine_dir.clone());

        let protected_file = PathBuf::from("/etc/shadow");
        let safe_file = work_dir.join("safe.tmp");
        fs::write(&safe_file, b"safe data").unwrap();

        let res = store.stage_files(
            "session_fail",
            &["rule.test".to_string()],
            &[safe_file.clone(), protected_file],
        );
        assert!(
            res.is_err(),
            "Must reject entire staging if any protected path is present"
        );
        assert!(
            safe_file.exists(),
            "Safe file should remain untouched due to pre-validation failure"
        );

        let _ = fs::remove_dir_all(&quarantine_dir);
        let _ = fs::remove_dir_all(&work_dir);
    }

    #[test]
    fn test_purge_session() {
        let (quarantine_dir, work_dir) = create_test_env("purge_test");
        let store = QuarantineStore::new(quarantine_dir.clone());

        let file_a = work_dir.join("purge_me.tmp");
        fs::write(&file_a, b"purge content").unwrap();

        let session_id = "session_purge_1";
        store
            .stage_files(session_id, &["rule.purge".to_string()], &[file_a])
            .unwrap();

        assert!(store.manifest_path(session_id).exists());

        let purged_bytes = store.purge_session(session_id).unwrap();
        assert_eq!(purged_bytes, 13);
        assert!(
            !store.session_path(session_id).exists(),
            "Session dir must be gone"
        );

        let _ = fs::remove_dir_all(&quarantine_dir);
        let _ = fs::remove_dir_all(&work_dir);
    }
}
