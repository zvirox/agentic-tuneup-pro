#![allow(unsafe_code)]

use atp_core::{CoreError, ErrorKind};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use sysinfo::{Pid, ProcessesToUpdate, System};

pub const CRITICAL_PROCESS_NAMES: &[&str] = &[
    "systemd",
    "init",
    "dbus-daemon",
    "dbus-broker",
    "polkitd",
    "sshd",
    "kthreadd",
    "Xorg",
    "Xwayland",
    "gnome-shell",
    "hyprland",
    "sway",
    "pipewire",
    "wireplumber",
    "agetty",
    "login",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessEntry {
    pub pid: u32,
    pub ppid: Option<u32>,
    pub name: String,
    pub display_name: String,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub io_read_bytes_per_sec: u64,
    pub is_critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppProcessGroup {
    pub group_id: String,
    pub app_name: String,
    pub root_pid: u32,
    pub process_count: usize,
    pub total_cpu_percent: f32,
    pub total_memory_bytes: u64,
    pub pids: Vec<u32>,
    pub is_critical: bool,
}

pub struct ProcessManager;

impl ProcessManager {
    pub fn is_critical_process(name: &str, pid: u32) -> bool {
        if pid <= 1 {
            return true;
        }

        let clean_name = name.to_lowercase();
        CRITICAL_PROCESS_NAMES
            .iter()
            .any(|&crit| clean_name == crit || clean_name.starts_with(crit))
    }

    /// Queries the live system processes, sorting by CPU or memory.
    pub fn list_processes(sort_by: &str) -> Vec<ProcessEntry> {
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::All, true);

        let mut entries: Vec<ProcessEntry> = sys
            .processes()
            .iter()
            .map(|(pid, proc_info)| {
                let name = proc_info.name().to_string_lossy().to_string();
                let pid_u32 = pid.as_u32();
                let is_critical = Self::is_critical_process(&name, pid_u32);

                ProcessEntry {
                    pid: pid_u32,
                    ppid: proc_info.parent().map(|p| p.as_u32()),
                    name: name.clone(),
                    display_name: name,
                    cpu_percent: proc_info.cpu_usage(),
                    memory_bytes: proc_info.memory(),
                    io_read_bytes_per_sec: proc_info.disk_usage().read_bytes,
                    is_critical,
                }
            })
            .collect();

        if sort_by == "memory" {
            entries.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
        } else {
            entries.sort_by(|a, b| {
                b.cpu_percent
                    .partial_cmp(&a.cpu_percent)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        }

        entries
    }

    /// Groups running processes by application stem (e.g. collapsing 25 Chrome processes into 1).
    pub fn list_app_groups(sort_by: &str) -> Vec<AppProcessGroup> {
        let procs = Self::list_processes("cpu");
        let mut groups: HashMap<String, AppProcessGroup> = HashMap::new();

        for proc_entry in procs {
            let key = proc_entry
                .name
                .split('-')
                .next()
                .unwrap_or(&proc_entry.name)
                .to_lowercase();

            let group = groups
                .entry(key.clone())
                .or_insert_with(|| AppProcessGroup {
                    group_id: key.clone(),
                    app_name: proc_entry.name.clone(),
                    root_pid: proc_entry.pid,
                    process_count: 0,
                    total_cpu_percent: 0.0,
                    total_memory_bytes: 0,
                    pids: Vec::new(),
                    is_critical: proc_entry.is_critical,
                });

            group.process_count += 1;
            group.total_cpu_percent += proc_entry.cpu_percent;
            group.total_memory_bytes += proc_entry.memory_bytes;
            group.pids.push(proc_entry.pid);
            if proc_entry.is_critical {
                group.is_critical = true;
            }
        }

        let mut result: Vec<AppProcessGroup> = groups.into_values().collect();

        if sort_by == "memory" {
            result.sort_by(|a, b| b.total_memory_bytes.cmp(&a.total_memory_bytes));
        } else {
            result.sort_by(|a, b| {
                b.total_cpu_percent
                    .partial_cmp(&a.total_cpu_percent)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        }

        result
    }

    /// Collects all child/descendant PIDs of a given process recursively.
    pub fn find_descendant_pids(root_pid: u32) -> Vec<u32> {
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::All, true);

        // Map parent -> children
        let mut parent_to_children: HashMap<u32, Vec<u32>> = HashMap::new();
        for (pid, proc_info) in sys.processes() {
            if let Some(ppid) = proc_info.parent() {
                parent_to_children
                    .entry(ppid.as_u32())
                    .or_default()
                    .push(pid.as_u32());
            }
        }

        let mut descendants = Vec::new();
        let mut queue = vec![root_pid];
        let mut visited = HashSet::new();
        visited.insert(root_pid);

        while let Some(current) = queue.pop() {
            if let Some(children) = parent_to_children.get(&current) {
                for &child in children {
                    if visited.insert(child) {
                        descendants.push(child);
                        queue.push(child);
                    }
                }
            }
        }

        descendants
    }

    /// Sends a POSIX signal to a single PID, strictly guarded by critical process protection.
    pub fn send_signal(pid: u32, signal: i32) -> Result<(), CoreError> {
        if pid <= 1 {
            return Err(CoreError::new(
                ErrorKind::Safety,
                "safety.critical_process_protected",
                false,
                "Refusing to send signal to PID 1 (init/systemd).",
                Some(serde_json::json!({ "pid": pid })),
            ));
        }

        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);

        if let Some(proc_info) = sys.process(Pid::from_u32(pid)) {
            let name = proc_info.name().to_string_lossy();
            if Self::is_critical_process(&name, pid) {
                return Err(CoreError::new(
                    ErrorKind::Safety,
                    "safety.critical_process_protected",
                    false,
                    format!(
                        "Process '{name}' (PID {pid}) is a critical system service and cannot be terminated."
                    ),
                    Some(serde_json::json!({ "pid": pid, "name": name })),
                ));
            }
        }

        let res = unsafe { libc::kill(pid as i32, signal) };
        if res == 0 {
            Ok(())
        } else {
            Err(CoreError::new(
                ErrorKind::Safety,
                "safety.kill_failed",
                false,
                format!(
                    "Failed sending signal {signal} to PID {pid}: {}",
                    std::io::Error::last_os_error()
                ),
                Some(serde_json::json!({ "pid": pid, "signal": signal })),
            ))
        }
    }

    /// Kills a process and all of its recursive child processes cleanly.
    pub fn kill_process_tree(pid: u32, signal: i32) -> Result<Vec<u32>, CoreError> {
        let mut descendants = Self::find_descendant_pids(pid);
        let mut terminated = Vec::new();

        // Terminate children from leaves up
        descendants.reverse();
        for child_pid in descendants {
            if Self::send_signal(child_pid, signal).is_ok() {
                terminated.push(child_pid);
            }
        }

        // Finally terminate parent
        Self::send_signal(pid, signal)?;
        terminated.push(pid);

        Ok(terminated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_critical_process_detection() {
        assert!(ProcessManager::is_critical_process("systemd", 1));
        assert!(ProcessManager::is_critical_process("dbus-daemon", 450));
        assert!(ProcessManager::is_critical_process("polkitd", 600));
        assert!(!ProcessManager::is_critical_process("firefox", 4500));
        assert!(!ProcessManager::is_critical_process("spotify", 8200));
    }

    #[test]
    fn test_list_processes_returns_entries() {
        let procs = ProcessManager::list_processes("cpu");
        assert!(!procs.is_empty());
        assert!(procs.iter().any(|p| p.pid > 0));
    }

    #[test]
    fn test_list_app_groups_aggregates() {
        let groups = ProcessManager::list_app_groups("cpu");
        assert!(!groups.is_empty());
    }

    #[test]
    fn test_blocks_kill_on_pid_1() {
        let res = ProcessManager::send_signal(1, libc::SIGTERM);
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert_eq!(err.code, "safety.critical_process_protected");
    }
}
