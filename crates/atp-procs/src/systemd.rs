use atp_core::{CoreError, ErrorKind};
use serde::{Deserialize, Serialize};

pub const PROTECTED_SERVICES: &[&str] = &[
    "dbus.service",
    "dbus-broker.service",
    "systemd-journald.service",
    "systemd-logind.service",
    "systemd-udevd.service",
    "polkit.service",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceEntry {
    pub unit_name: String,
    pub description: String,
    pub load_state: String,
    pub active_state: String,
    pub sub_state: String,
    pub is_user_unit: bool,
}

pub struct SystemdManager;

impl SystemdManager {
    pub fn is_protected_service(unit_name: &str) -> bool {
        let clean = unit_name.to_lowercase();
        PROTECTED_SERVICES.iter().any(|&p| clean == p)
    }

    /// Lists active and inactive systemd service units.
    pub async fn list_services(user_mode: bool) -> Result<Vec<ServiceEntry>, CoreError> {
        let mut cmd = tokio::process::Command::new("systemctl");
        if user_mode {
            cmd.arg("--user");
        }
        cmd.args([
            "list-units",
            "--type=service",
            "--all",
            "--no-pager",
            "--plain",
        ]);

        let output = cmd.output().await.map_err(|e| {
            CoreError::new(
                ErrorKind::Helper,
                "helper.systemctl_failed",
                true,
                format!("Failed executing systemctl list-units: {e}"),
                None,
            )
        })?;

        let mut services = Vec::new();
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty()
                    || trimmed.starts_with("LOAD")
                    || trimmed.starts_with("To show")
                {
                    continue;
                }

                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 4 && parts[0].ends_with(".service") {
                    let unit_name = parts[0].to_string();
                    let load_state = parts[1].to_string();
                    let active_state = parts[2].to_string();
                    let sub_state = parts[3].to_string();
                    let description = parts[4..].join(" ");

                    services.push(ServiceEntry {
                        unit_name,
                        description,
                        load_state,
                        active_state,
                        sub_state,
                        is_user_unit: user_mode,
                    });
                }
            }
        }

        Ok(services)
    }

    /// Controls a systemd service unit with safety validation.
    pub async fn control_service(
        unit_name: &str,
        action: &str,
        user_mode: bool,
    ) -> Result<(), CoreError> {
        let valid_actions = ["start", "stop", "restart", "enable", "disable", "reload"];
        if !valid_actions.contains(&action) {
            return Err(CoreError::new(
                ErrorKind::Helper,
                "helper.invalid_service_action",
                false,
                format!(
                    "Invalid service action '{action}'. Allowed: start, stop, restart, enable, disable, reload"
                ),
                None,
            ));
        }

        if (action == "stop" || action == "disable") && Self::is_protected_service(unit_name) {
            return Err(CoreError::new(
                ErrorKind::Safety,
                "safety.protected_service_action",
                false,
                format!(
                    "Service '{unit_name}' is a protected core system service and cannot be stopped or disabled."
                ),
                Some(serde_json::json!({ "unitName": unit_name, "action": action })),
            ));
        }

        let mut cmd = tokio::process::Command::new("systemctl");
        if user_mode {
            cmd.arg("--user");
        }
        cmd.args([action, unit_name]);

        let output = cmd.output().await.map_err(|e| {
            CoreError::new(
                ErrorKind::Helper,
                "helper.systemctl_failed",
                false,
                format!("Failed executing systemctl {action} {unit_name}: {e}"),
                None,
            )
        })?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(CoreError::new(
                ErrorKind::Helper,
                "helper.service_action_failed",
                false,
                format!("systemctl {action} {unit_name} failed: {stderr}"),
                Some(
                    serde_json::json!({ "unitName": unit_name, "action": action, "stderr": stderr }),
                ),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protected_service_check() {
        assert!(SystemdManager::is_protected_service("dbus.service"));
        assert!(SystemdManager::is_protected_service(
            "systemd-logind.service"
        ));
        assert!(!SystemdManager::is_protected_service("cups.service"));
        assert!(!SystemdManager::is_protected_service("bluetooth.service"));
    }

    #[tokio::test]
    async fn test_protected_service_blocks_stop() {
        let res = SystemdManager::control_service("dbus.service", "stop", false).await;
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert_eq!(err.code, "safety.protected_service_action");
    }

    #[tokio::test]
    async fn test_invalid_action_rejected() {
        let res = SystemdManager::control_service("any.service", "kill_hard", false).await;
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert_eq!(err.code, "helper.invalid_service_action");
    }
}
