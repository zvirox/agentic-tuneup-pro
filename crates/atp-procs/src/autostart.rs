use atp_core::{CoreError, ErrorKind};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutostartEntry {
    pub file_name: String,
    pub name: String,
    pub comment: Option<String>,
    pub exec: String,
    pub enabled: bool,
    pub path: String,
}

pub struct AutostartManager;

impl AutostartManager {
    pub fn user_autostart_dir() -> PathBuf {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        PathBuf::from(home).join(".config/autostart")
    }

    pub fn system_autostart_dir() -> PathBuf {
        PathBuf::from("/etc/xdg/autostart")
    }

    pub fn parse_desktop_file(path: &Path) -> Option<AutostartEntry> {
        let content = fs::read_to_string(path).ok()?;
        let file_name = path.file_name()?.to_string_lossy().to_string();

        let mut name = file_name.trim_end_matches(".desktop").to_string();
        let mut exec = String::new();
        let mut comment = None;
        let mut hidden = false;
        let mut gnome_enabled = true;

        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(val) = trimmed.strip_prefix("Name=") {
                name = val.to_string();
            } else if let Some(val) = trimmed.strip_prefix("Exec=") {
                exec = val.to_string();
            } else if let Some(val) = trimmed.strip_prefix("Comment=") {
                comment = Some(val.to_string());
            } else if let Some(val) = trimmed.strip_prefix("Hidden=") {
                hidden = val.eq_ignore_ascii_case("true");
            } else if let Some(val) = trimmed.strip_prefix("X-GNOME-Autostart-enabled=") {
                gnome_enabled = !val.eq_ignore_ascii_case("false");
            }
        }

        if exec.is_empty() {
            return None;
        }

        let enabled = !hidden && gnome_enabled;

        Some(AutostartEntry {
            file_name,
            name,
            comment,
            exec,
            enabled,
            path: path.to_string_lossy().to_string(),
        })
    }

    /// Lists all discovered user and system autostart applications.
    pub fn list_entries() -> Vec<AutostartEntry> {
        let mut entries = Vec::new();

        // 1. User autostart
        let user_dir = Self::user_autostart_dir();
        if user_dir.exists() {
            if let Ok(read_dir) = fs::read_dir(&user_dir) {
                for item in read_dir.flatten() {
                    let path = item.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("desktop") {
                        if let Some(entry) = Self::parse_desktop_file(&path) {
                            entries.push(entry);
                        }
                    }
                }
            }
        }

        // 2. System autostart (if not overridden by user)
        let sys_dir = Self::system_autostart_dir();
        if sys_dir.exists() {
            if let Ok(read_dir) = fs::read_dir(&sys_dir) {
                for item in read_dir.flatten() {
                    let path = item.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("desktop") {
                        let fname = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                        if !entries.iter().any(|e| e.file_name == fname) {
                            if let Some(entry) = Self::parse_desktop_file(&path) {
                                entries.push(entry);
                            }
                        }
                    }
                }
            }
        }

        entries
    }

    /// Toggles the enabled status of an autostart entry by writing to `~/.config/autostart`.
    pub fn toggle_entry(file_name: &str, enable: bool) -> Result<(), CoreError> {
        let user_dir = Self::user_autostart_dir();
        fs::create_dir_all(&user_dir).map_err(|e| {
            CoreError::new(
                ErrorKind::Helper,
                "helper.autostart_dir_failed",
                false,
                format!("Failed creating autostart dir {}: {e}", user_dir.display()),
                None,
            )
        })?;

        let target_file = user_dir.join(file_name);

        let mut content = if target_file.exists() {
            fs::read_to_string(&target_file).unwrap_or_default()
        } else {
            // Check system dir as template
            let sys_candidate = Self::system_autostart_dir().join(file_name);
            if sys_candidate.exists() {
                fs::read_to_string(&sys_candidate).unwrap_or_default()
            } else {
                format!(
                    "[Desktop Entry]\nType=Application\nName={}\nExec={}\n",
                    file_name.trim_end_matches(".desktop"),
                    file_name
                )
            }
        };

        // Update or append flags
        let hidden_line = format!("Hidden={}", !enable);
        let gnome_line = format!("X-GNOME-Autostart-enabled={}", enable);

        let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        lines.retain(|l| !l.starts_with("Hidden=") && !l.starts_with("X-GNOME-Autostart-enabled="));
        lines.push(hidden_line);
        lines.push(gnome_line);

        content = lines.join("\n") + "\n";

        fs::write(&target_file, content).map_err(|e| {
            CoreError::new(
                ErrorKind::Helper,
                "helper.autostart_write_failed",
                false,
                format!(
                    "Failed writing autostart file {}: {e}",
                    target_file.display()
                ),
                None,
            )
        })?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_desktop_file() {
        let temp_dir = std::env::temp_dir().join("test_autostart");
        let _ = fs::create_dir_all(&temp_dir);
        let test_file = temp_dir.join("test_app.desktop");

        let content = "[Desktop Entry]\nName=Test Application\nExec=/usr/bin/testapp --flag\nComment=Starts test app\nHidden=false\n";
        fs::write(&test_file, content).unwrap();

        let entry = AutostartManager::parse_desktop_file(&test_file).expect("parsed entry");
        assert_eq!(entry.name, "Test Application");
        assert_eq!(entry.exec, "/usr/bin/testapp --flag");
        assert!(entry.enabled);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
