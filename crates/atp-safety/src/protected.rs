use std::path::Path;
use atp_core::{CoreError, ErrorKind};

pub struct ProtectedValidator;

impl ProtectedValidator {
    /// Validates whether a given path is safe to inspect or clean.
    ///
    /// # Errors
    /// Returns `CoreError` if the path matches browser password stores,
    /// cryptographic keys, keyrings, or protected system root hierarchies.
    pub fn validate(path: &Path) -> Result<(), CoreError> {
        let path_str = path.to_string_lossy();

        // 1. Check for directory traversal sequences
        if path_str.contains("..") {
            return Err(CoreError::new(
                ErrorKind::Safety,
                "safety.path_traversal",
                false,
                "Path contains invalid directory traversal sequences.",
                Some(serde_json::json!({ "path": path_str })),
            ));
        }

        // 2. Browser password files and credential databases (Hard Invariant)
        let password_indicators = [
            "Login Data",
            "Login Data For Account",
            "logins.json",
            "key4.db",
            "cert9.db",
        ];

        for indicator in password_indicators {
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

        // 3. User secrets and identity stores
        let secret_indicators = [
            "/.ssh",
            "/.gnupg",
            "/.local/share/keyrings",
            "/.pki",
        ];

        for indicator in secret_indicators {
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

        // 4. System root hierarchies (only package managers touch /usr via polkit)
        if path_str.starts_with("/etc") || path_str.starts_with("/boot") || path_str.starts_with("/sys") || path_str.starts_with("/proc") {
            return Err(CoreError::new(
                ErrorKind::Safety,
                "safety.protected_system_root",
                false,
                "Direct mutation of core system operating system trees is forbidden.",
                Some(serde_json::json!({ "path": path_str })),
            ));
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
    fn test_blocks_etc_shadow() {
        let path = PathBuf::from("/etc/shadow");
        assert!(ProtectedValidator::validate(&path).is_err());
    }

    #[test]
    fn test_allows_safe_cache_path() {
        let path = PathBuf::from("/home/user/.cache/google-chrome/Default/Cache/data_0");
        assert!(ProtectedValidator::validate(&path).is_ok());
    }
}
