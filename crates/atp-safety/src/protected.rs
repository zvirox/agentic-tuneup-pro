use std::path::{Component, Path};
use atp_core::{CoreError, ErrorKind};

pub struct ProtectedValidator;

impl ProtectedValidator {
    const PASSWORD_PATTERNS: &'static [&'static str] = &[
        "Login Data",
        "Login Data For Account",
        "logins.json",
        "key4.db",
        "cert9.db",
    ];

    const SECRET_PATH_PATTERNS: &'static [&'static str] = &[
        "/.ssh",
        "/.gnupg",
        "/.local/share/keyrings",
        "/.pki",
        "/keyrings/",
    ];

    const SYSTEM_ROOT_PREFIXES: &'static [&'static str] = &[
        "/etc",
        "/boot",
        "/sys",
        "/proc",
        "/dev",
        "/root",
        "/usr",
        "/sbin",
        "/bin",
        "/lib",
        "/lib64",
    ];

    /// Validates whether a given path is safe to inspect or clean.
    ///
    /// # Errors
    /// Returns `CoreError` if the path or any symlink target matches browser password stores,
    /// cryptographic keys, keyrings, or protected system root hierarchies.
    pub fn validate(path: &Path) -> Result<(), CoreError> {
        Self::check_traversal(path)?;
        
        let path_str = path.to_string_lossy();
        Self::check_forbidden_patterns(&path_str)?;
        Self::check_system_roots(&path_str)?;
        Self::check_symlink_targets(path)?;

        Ok(())
    }

    fn check_traversal(path: &Path) -> Result<(), CoreError> {
        for component in path.components() {
            if component == Component::ParentDir {
                return Err(CoreError::new(
                    ErrorKind::Safety,
                    "safety.path_traversal",
                    false,
                    "Path contains invalid directory traversal sequences ('..').",
                    Some(serde_json::json!({ "path": path.display().to_string() })),
                ));
            }
        }
        Ok(())
    }

    fn check_forbidden_patterns(path_str: &str) -> Result<(), CoreError> {
        for indicator in Self::PASSWORD_PATTERNS {
            if path_str.contains(indicator) {
                return Err(CoreError::new(
                    ErrorKind::Safety,
                    "safety.protected_browser_passwords",
                    false,
                    "Access to browser password databases is strictly forbidden.",
                    Some(serde_json::json!({ "path": path_str, "blocked_indicator": indicator })),
                ));
            }
        }

        for indicator in Self::SECRET_PATH_PATTERNS {
            if path_str.contains(indicator) {
                return Err(CoreError::new(
                    ErrorKind::Safety,
                    "safety.protected_user_secrets",
                    false,
                    "Access to SSH, GPG, or system keyrings is strictly forbidden.",
                    Some(serde_json::json!({ "path": path_str, "blocked_indicator": indicator })),
                ));
            }
        }

        Ok(())
    }

    fn check_system_roots(path_str: &str) -> Result<(), CoreError> {
        for prefix in Self::SYSTEM_ROOT_PREFIXES {
            // Match whole path components: "/dev" blocks "/dev/sda" but not "/developer".
            if path_str == *prefix || path_str.starts_with(&format!("{prefix}/")) {
                return Err(CoreError::new(
                    ErrorKind::Safety,
                    "safety.protected_system_root",
                    false,
                    "Direct mutation of core system operating system trees is forbidden.",
                    Some(serde_json::json!({ "path": path_str, "prefix": prefix })),
                ));
            }
        }
        Ok(())
    }

    fn check_symlink_targets(path: &Path) -> Result<(), CoreError> {
        // If file exists and is a symlink, validate the resolved target path
        if let Ok(metadata) = std::fs::symlink_metadata(path) {
            if metadata.file_type().is_symlink() {
                if let Ok(target) = std::fs::read_link(path) {
                    let target_str = target.to_string_lossy();
                    Self::check_forbidden_patterns(&target_str)?;
                    Self::check_system_roots(&target_str)?;
                }
                if let Ok(canonical) = std::fs::canonicalize(path) {
                    let canonical_str = canonical.to_string_lossy();
                    Self::check_forbidden_patterns(&canonical_str)?;
                    Self::check_system_roots(&canonical_str)?;
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_blocks_chrome_login_data() {
        let path = PathBuf::from("/home/user/.config/google-chrome/Default/Login Data");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_blocks_firefox_logins_json() {
        let path = PathBuf::from("/home/user/.mozilla/firefox/profile.default/logins.json");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_blocks_ssh_keys() {
        let path = PathBuf::from("/home/user/.ssh/id_ed25519");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_blocks_gnupg_directory() {
        let path = PathBuf::from("/home/user/.gnupg/pubring.kbx");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_blocks_etc_shadow() {
        let path = PathBuf::from("/etc/shadow");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_blocks_usr_bin() {
        let path = PathBuf::from("/usr/bin/sudo");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_blocks_root_home() {
        let path = PathBuf::from("/root/.bashrc");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_blocks_path_traversal() {
        let path = PathBuf::from("/home/user/.cache/../../etc/passwd");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_blocks_symlink_to_protected_target() {
        let tmp_dir = std::env::temp_dir().join(format!("atp_test_symlink_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&tmp_dir);
        let link_path = tmp_dir.join("sneaky_link");

        #[cfg(unix)]
        {
            let _ = std::os::unix::fs::symlink("/etc/shadow", &link_path);
            let validation = ProtectedValidator::validate(&link_path);
            let _ = std::fs::remove_file(&link_path);
            let _ = std::fs::remove_dir(&tmp_dir);
            assert!(validation.is_err(), "Symlink pointing to /etc/shadow must be blocked");
        }
    }

    #[test]
    fn test_allows_safe_cache_path() {
        let path = PathBuf::from("/home/user/.cache/google-chrome/Default/Cache/data_0");
        assert!(ProtectedValidator::validate(&path).is_ok());
    }

    #[test]
    fn test_system_root_check_is_component_aware() {
        assert!(ProtectedValidator::validate(&PathBuf::from("/dev/sda")).is_err());
        assert!(ProtectedValidator::validate(&PathBuf::from("/etc")).is_err());
        assert!(ProtectedValidator::validate(&PathBuf::from("/developer/cache/x")).is_ok());
        assert!(ProtectedValidator::validate(&PathBuf::from("/binaries/tmp")).is_ok());
    }
}
