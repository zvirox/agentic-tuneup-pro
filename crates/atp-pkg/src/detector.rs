use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DistroFamily {
    Arch,
    Debian,
    Fedora,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct HostSystemProfile {
    pub distro: DistroFamily,
    pub distro_name: String,
    pub has_flatpak: bool,
    pub has_appimage_dirs: bool,
}

impl HostSystemProfile {
    /// Detects current Linux distribution and available packaging tools.
    pub fn detect() -> Self {
        let (distro, distro_name) = Self::detect_distro("/etc/os-release");
        let has_flatpak = Self::detect_binary("flatpak");
        let has_appimage_dirs = Self::detect_appimage_presence();

        Self {
            distro,
            distro_name,
            has_flatpak,
            has_appimage_dirs,
        }
    }

    pub fn detect_distro(os_release_path: impl AsRef<Path>) -> (DistroFamily, String) {
        let path = os_release_path.as_ref();
        if !path.exists() {
            return (DistroFamily::Unknown, "Generic Linux".into());
        }

        let content = fs::read_to_string(path).unwrap_or_default();
        let mut id = String::new();
        let mut id_like = String::new();
        let mut pretty_name = String::new();

        for line in content.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("ID=") {
                id = val.trim_matches('"').to_lowercase();
            } else if let Some(val) = line.strip_prefix("ID_LIKE=") {
                id_like = val.trim_matches('"').to_lowercase();
            } else if let Some(val) = line.strip_prefix("PRETTY_NAME=") {
                pretty_name = val.trim_matches('"').to_string();
            }
        }

        let family = if id == "arch" || id_like.contains("arch") || id == "manjaro" || id == "endeavouros" {
            DistroFamily::Arch
        } else if id == "debian" || id == "ubuntu" || id_like.contains("debian") || id_like.contains("ubuntu") {
            DistroFamily::Debian
        } else if id == "fedora" || id == "rhel" || id_like.contains("fedora") || id_like.contains("rhel") {
            DistroFamily::Fedora
        } else {
            DistroFamily::Unknown
        };

        let display_name = if pretty_name.is_empty() {
            if id.is_empty() { "Linux".to_string() } else { id }
        } else {
            pretty_name
        };

        (family, display_name)
    }

    pub fn detect_binary(binary_name: &str) -> bool {
        if let Ok(path_var) = std::env::var("PATH") {
            for dir in path_var.split(':') {
                let candidate = PathBuf::from(dir).join(binary_name);
                if candidate.is_file() {
                    return true;
                }
            }
        }
        false
    }

    pub fn detect_appimage_presence() -> bool {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let candidates = [
            PathBuf::from(&home).join("Applications"),
            PathBuf::from(&home).join(".local/bin"),
            PathBuf::from("/opt"),
        ];

        candidates.iter().any(|p| p.exists() && p.is_dir())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_arch_os_release() {
        let content = "NAME=\"Arch Linux\"\nPRETTY_NAME=\"Arch Linux\"\nID=arch\nBUILD_ID=rolling\n";
        let temp_file = std::env::temp_dir().join("test_os_release_arch");
        fs::write(&temp_file, content).unwrap();

        let (family, name) = HostSystemProfile::detect_distro(&temp_file);
        assert_eq!(family, DistroFamily::Arch);
        assert_eq!(name, "Arch Linux");

        let _ = fs::remove_file(temp_file);
    }

    #[test]
    fn test_detect_ubuntu_os_release() {
        let content = "NAME=\"Ubuntu\"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME=\"Ubuntu 24.04 LTS\"\n";
        let temp_file = std::env::temp_dir().join("test_os_release_ubuntu");
        fs::write(&temp_file, content).unwrap();

        let (family, name) = HostSystemProfile::detect_distro(&temp_file);
        assert_eq!(family, DistroFamily::Debian);
        assert_eq!(name, "Ubuntu 24.04 LTS");

        let _ = fs::remove_file(temp_file);
    }
}
