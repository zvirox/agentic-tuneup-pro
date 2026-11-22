use zbus::{interface, fdo};
use crate::validator::{
    is_valid_backend, is_valid_keep_days, is_valid_package_action,
    is_valid_package_name, is_valid_service_action, is_valid_service_unit,
    is_valid_signal,
};

pub struct AgenticTuneupHelper;

impl AgenticTuneupHelper {
    pub async fn handle_manage_package(
        &self,
        action: &str,
        backend: &str,
        package_name: &str,
    ) -> fdo::Result<String> {
        if !is_valid_package_action(action) {
            return Err(fdo::Error::InvalidArgs(format!("Invalid package action: '{action}'")));
        }
        if !is_valid_backend(backend) {
            return Err(fdo::Error::InvalidArgs(format!("Unsupported backend: '{backend}'")));
        }
        if !package_name.is_empty() && !is_valid_package_name(package_name) {
            return Err(fdo::Error::InvalidArgs(format!("Invalid package name: '{package_name}'")));
        }

        let output = match backend {
            "flatpak" => Self::exec_flatpak(action, package_name).await?,
            "apt" => Self::exec_apt(action, package_name).await?,
            "pacman" => Self::exec_pacman(action, package_name).await?,
            _ => return Err(fdo::Error::NotSupported("Backend not supported".into())),
        };

        Ok(output)
    }

    pub async fn handle_vacuum_journal(&self, keep_days: u32) -> fdo::Result<String> {
        if !is_valid_keep_days(keep_days) {
            return Err(fdo::Error::InvalidArgs("keep_days must be between 1 and 365".into()));
        }

        let mut cmd = tokio::process::Command::new("journalctl");
        cmd.arg(format!("--vacuum-time={}d", keep_days));

        let res = cmd.output().await.map_err(|e| {
            fdo::Error::Failed(format!("Failed executing journalctl: {e}"))
        })?;

        Ok(String::from_utf8_lossy(&res.stdout).to_string())
    }

    pub async fn handle_kill_process(&self, pid: u32, signal: i32) -> fdo::Result<bool> {
        if !is_valid_signal(signal) {
            return Err(fdo::Error::InvalidArgs("Signal must be 15 (SIGTERM) or 9 (SIGKILL)".into()));
        }
        if pid <= 1 {
            return Err(fdo::Error::Failed("Refusing to terminate root init process (PID <= 1)".into()));
        }

        let mut cmd = tokio::process::Command::new("kill");
        cmd.arg(format!("-{signal}")).arg(pid.to_string());

        let res = cmd.status().await.map_err(|e| {
            fdo::Error::Failed(format!("Failed executing kill: {e}"))
        })?;

        Ok(res.success())
    }

    pub async fn handle_control_service(&self, unit: &str, action: &str) -> fdo::Result<bool> {
        if !is_valid_service_unit(unit) {
            return Err(fdo::Error::InvalidArgs(format!("Invalid service unit name: '{unit}'")));
        }
        if !is_valid_service_action(action) {
            return Err(fdo::Error::InvalidArgs(format!("Invalid service action: '{action}'")));
        }

        let mut cmd = tokio::process::Command::new("systemctl");
        cmd.arg(action).arg(unit);

        let res = cmd.status().await.map_err(|e| {
            fdo::Error::Failed(format!("Failed executing systemctl: {e}"))
        })?;

        Ok(res.success())
    }

    async fn exec_flatpak(action: &str, package: &str) -> fdo::Result<String> {
        let mut cmd = tokio::process::Command::new("flatpak");
        match action {
            "install" => {
                cmd.args(["install", "-y", "--noninteractive", package]);
            }
            "remove" => {
                cmd.args(["uninstall", "-y", "--noninteractive", package]);
            }
            "update" => {
                cmd.args(["update", "-y", "--noninteractive"]);
            }
            "clean" | "autoremove" => {
                cmd.args(["uninstall", "--unused", "-y", "--noninteractive"]);
            }
            _ => return Err(fdo::Error::InvalidArgs("Unsupported action for flatpak".into())),
        }

        let res = cmd.output().await.map_err(|e| {
            fdo::Error::Failed(format!("Failed executing flatpak: {e}"))
        })?;

        Ok(String::from_utf8_lossy(&res.stdout).to_string())
    }

    async fn exec_apt(action: &str, package: &str) -> fdo::Result<String> {
        let mut cmd = tokio::process::Command::new("apt-get");
        cmd.env("DEBIAN_FRONTEND", "noninteractive");
        match action {
            "install" => {
                cmd.args(["install", "-y", package]);
            }
            "remove" => {
                cmd.args(["remove", "-y", package]);
            }
            "update" => {
                cmd.args(["upgrade", "-y"]);
            }
            "clean" => {
                cmd.arg("clean");
            }
            "autoremove" => {
                cmd.args(["autoremove", "-y"]);
            }
            _ => return Err(fdo::Error::InvalidArgs("Unsupported action for apt".into())),
        }

        let res = cmd.output().await.map_err(|e| {
            fdo::Error::Failed(format!("Failed executing apt-get: {e}"))
        })?;

        Ok(String::from_utf8_lossy(&res.stdout).to_string())
    }

    async fn exec_pacman(action: &str, package: &str) -> fdo::Result<String> {
        let mut cmd = tokio::process::Command::new("pacman");
        match action {
            "install" => {
                cmd.args(["-S", "--noconfirm", package]);
            }
            "remove" => {
                cmd.args(["-Rns", "--noconfirm", package]);
            }
            "update" => {
                cmd.args(["-Syu", "--noconfirm"]);
            }
            "clean" => {
                cmd.args(["-Sc", "--noconfirm"]);
            }
            _ => return Err(fdo::Error::InvalidArgs("Unsupported action for pacman".into())),
        }

        let res = cmd.output().await.map_err(|e| {
            fdo::Error::Failed(format!("Failed executing pacman: {e}"))
        })?;

        Ok(String::from_utf8_lossy(&res.stdout).to_string())
    }
}

#[interface(name = "in.zvirox.AgenticTuneupHelper")]
impl AgenticTuneupHelper {
    async fn manage_package(
        &self,
        action: &str,
        backend: &str,
        package_name: &str,
    ) -> fdo::Result<String> {
        self.handle_manage_package(action, backend, package_name).await
    }

    async fn vacuum_journal(&self, keep_days: u32) -> fdo::Result<String> {
        self.handle_vacuum_journal(keep_days).await
    }

    async fn kill_process(&self, pid: u32, signal: i32) -> fdo::Result<bool> {
        self.handle_kill_process(pid, signal).await
    }

    async fn control_service(&self, unit: &str, action: &str) -> fdo::Result<bool> {
        self.handle_control_service(unit, action).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_package_validation_rejection() {
        let helper = AgenticTuneupHelper;

        // Reject invalid action
        let res1 = helper.handle_manage_package("drop_database", "flatpak", "org.test.app").await;
        assert!(matches!(res1, Err(fdo::Error::InvalidArgs(_))));

        // Reject unsupported backend
        let res2 = helper.handle_manage_package("install", "snap", "testapp").await;
        assert!(matches!(res2, Err(fdo::Error::InvalidArgs(_))));

        // Reject malicious package name with shell injection
        let res3 = helper.handle_manage_package("install", "apt", "evil;rm -rf /").await;
        assert!(matches!(res3, Err(fdo::Error::InvalidArgs(_))));
    }

    #[tokio::test]
    async fn test_journal_vacuum_bounds() {
        let helper = AgenticTuneupHelper;

        let res_zero = helper.handle_vacuum_journal(0).await;
        assert!(matches!(res_zero, Err(fdo::Error::InvalidArgs(_))));

        let res_over = helper.handle_vacuum_journal(500).await;
        assert!(matches!(res_over, Err(fdo::Error::InvalidArgs(_))));
    }

    #[tokio::test]
    async fn test_kill_process_guard() {
        let helper = AgenticTuneupHelper;

        // Cannot kill init (PID 1)
        let res_init = helper.handle_kill_process(1, 15).await;
        assert!(res_init.is_err());

        // Cannot send arbitrary signals
        let res_sig = helper.handle_kill_process(9999, 1).await;
        assert!(matches!(res_sig, Err(fdo::Error::InvalidArgs(_))));
    }

    #[tokio::test]
    async fn test_control_service_validation() {
        let helper = AgenticTuneupHelper;

        // Reject invalid unit
        let res_unit = helper.handle_control_service("evil.sh", "restart").await;
        assert!(matches!(res_unit, Err(fdo::Error::InvalidArgs(_))));

        // Reject invalid action
        let res_act = helper.handle_control_service("pipewire.service", "destroy").await;
        assert!(matches!(res_act, Err(fdo::Error::InvalidArgs(_))));
    }
}
