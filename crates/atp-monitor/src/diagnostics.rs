//! "Why is my PC slow?" Diagnostic Correlation Engine.

use crate::sampler::TelemetrySnapshot;
use serde::{Deserialize, Serialize};

/// High-level bottleneck category affecting system responsiveness.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BottleneckCategory {
    None,
    CpuSaturation,
    MemoryPressure,
    DiskPressure,
    ThermalThrottling,
    BackgroundIndexer,
}

/// Severity classification of a diagnosed issue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Info,
    Warning,
    Critical,
}

/// One-click automated remediation suggested by the diagnostic engine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemediationAction {
    pub action_type: String, // "clean_caches" | "kill_process" | "lower_priority" | "reduce_effects" | "purge_orphans"
    pub label: String,
    pub description: String,
    pub target: Option<String>,
}

/// A specific diagnosed issue with its metric trigger and remediation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosticIssue {
    pub id: String,
    pub severity: DiagnosticSeverity,
    pub title: String,
    pub description: String,
    pub metric: String,
    pub remediation: Option<RemediationAction>,
}

/// Complete diagnostic report answering "Why is my PC slow?".
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub timestamp: i64,
    pub health_score: u32,
    pub primary_bottleneck: BottleneckCategory,
    pub headline: String,
    pub issues: Vec<DiagnosticIssue>,
    pub recommendations: Vec<String>,
}

/// Diagnostic engine that correlates telemetry snapshots with known performance bottleneck heuristics.
pub struct DiagnosticEngine;

impl DiagnosticEngine {
    pub fn analyze(
        snapshot: &TelemetrySnapshot,
        health_score: u32,
        top_processes: &[(String, u32, f32, u64)], // (name, pid, cpu_percent, memory_bytes)
    ) -> DiagnosticReport {
        let mut issues = Vec::new();
        let mut primary_bottleneck = BottleneckCategory::None;

        // 1. Check Thermal Throttling
        if let Some(temp) = snapshot.cpu.temperature_celsius {
            if temp >= 85.0 {
                primary_bottleneck = BottleneckCategory::ThermalThrottling;
                issues.push(DiagnosticIssue {
                    id: "thermal_critical".to_string(),
                    severity: DiagnosticSeverity::Critical,
                    title: "CPU Thermal Throttling Active".to_string(),
                    description: format!(
                        "CPU package temperature is {temp:.1}°C. Hardware is actively clocking down to prevent damage, causing UI stutters."
                    ),
                    metric: format!("{temp:.0}°C"),
                    remediation: Some(RemediationAction {
                        action_type: "reduce_effects".to_string(),
                        label: "Enable Reduce Effects Mode".to_string(),
                        description: "Disable hardware blur and translucent composites to reduce GPU/CPU draw.".to_string(),
                        target: None,
                    }),
                });
            } else if temp >= 78.0 {
                issues.push(DiagnosticIssue {
                    id: "thermal_elevated".to_string(),
                    severity: DiagnosticSeverity::Warning,
                    title: "Elevated Processor Temperature".to_string(),
                    description: format!(
                        "CPU temperature is {temp:.1}°C. Fan curves may be ramping up."
                    ),
                    metric: format!("{temp:.0}°C"),
                    remediation: None,
                });
            }
        }

        // 2. Check CPU Saturation & Runaway Processes
        if snapshot.cpu.aggregate_usage_percent >= 85.0 {
            if primary_bottleneck == BottleneckCategory::None {
                primary_bottleneck = BottleneckCategory::CpuSaturation;
            }
            issues.push(DiagnosticIssue {
                id: "cpu_saturation".to_string(),
                severity: DiagnosticSeverity::Critical,
                title: "Processor Load Fully Saturated".to_string(),
                description: format!(
                    "System-wide CPU usage is {aggregate:.1}%. Thread starvation is causing application input latency.",
                    aggregate = snapshot.cpu.aggregate_usage_percent
                ),
                metric: format!("{:.0}% CPU", snapshot.cpu.aggregate_usage_percent),
                remediation: None,
            });
        }

        // Find individual process hogs
        for (name, pid, cpu, mem) in top_processes {
            // Check for known indexing hogs
            let is_indexer = name.contains("tracker-miner")
                || name.contains("baloo_file")
                || name.contains("updatedb");

            if is_indexer && *cpu > 15.0 {
                if primary_bottleneck == BottleneckCategory::None {
                    primary_bottleneck = BottleneckCategory::BackgroundIndexer;
                }
                issues.push(DiagnosticIssue {
                    id: format!("indexer_hog_{pid}"),
                    severity: DiagnosticSeverity::Warning,
                    title: format!("File Indexer Busy: {name}"),
                    description: format!(
                        "{name} (PID {pid}) is aggressively indexing storage, consuming {cpu:.1}% CPU."
                    ),
                    metric: format!("{cpu:.1}% CPU"),
                    remediation: Some(RemediationAction {
                        action_type: "lower_priority".to_string(),
                        label: "Throttle Indexer Priority".to_string(),
                        description: "Renice the process to lowest I/O and CPU priority.".to_string(),
                        target: Some(pid.to_string()),
                    }),
                });
            } else if *cpu >= 45.0 {
                issues.push(DiagnosticIssue {
                    id: format!("process_cpu_hog_{pid}"),
                    severity: DiagnosticSeverity::Warning,
                    title: format!("Runaway Process: {name}"),
                    description: format!(
                        "Process {name} (PID {pid}) is pegging a CPU core at {cpu:.1}%."
                    ),
                    metric: format!("{cpu:.1}% CPU"),
                    remediation: Some(RemediationAction {
                        action_type: "kill_process".to_string(),
                        label: format!("Terminate {name}"),
                        description: "Send graceful SIGTERM to stop this process tree.".to_string(),
                        target: Some(pid.to_string()),
                    }),
                });
            }

            // Memory hog check (> 2.5 GB)
            if *mem >= 2_500_000_000 {
                issues.push(DiagnosticIssue {
                    id: format!("process_mem_hog_{pid}"),
                    severity: DiagnosticSeverity::Warning,
                    title: format!("High Memory Consumer: {name}"),
                    description: format!(
                        "{name} (PID {pid}) is allocating {mem_gb:.2} GB of physical RAM.",
                        mem_gb = *mem as f64 / 1_000_000_000.0
                    ),
                    metric: format!("{:.1} GB", *mem as f64 / 1_000_000_000.0),
                    remediation: None,
                });
            }
        }

        // 3. Check Memory Pressure & Swap Thrashing
        let total_mem = snapshot.memory.total_bytes;
        let used_mem = snapshot.memory.used_bytes;
        let mem_ratio = if total_mem > 0 {
            used_mem as f64 / total_mem as f64
        } else {
            0.0
        };

        if mem_ratio >= 0.88 {
            if primary_bottleneck == BottleneckCategory::None {
                primary_bottleneck = BottleneckCategory::MemoryPressure;
            }
            issues.push(DiagnosticIssue {
                id: "memory_critical".to_string(),
                severity: DiagnosticSeverity::Critical,
                title: "Physical RAM Exhaustion".to_string(),
                description: format!(
                    "{pct:.1}% of memory is occupied. Linux page reclaim is actively paging into disk swap.",
                    pct = mem_ratio * 100.0
                ),
                metric: format!("{:.0}% RAM", mem_ratio * 100.0),
                remediation: Some(RemediationAction {
                    action_type: "clean_caches".to_string(),
                    label: "Reclaim Memory & Flush Caches".to_string(),
                    description: "Free unneeded application caches and package artifacts.".to_string(),
                    target: None,
                }),
            });
        }

        // 4. Check Disk Pressure
        let disk_ratio = if snapshot.disk.total_bytes > 0 {
            snapshot.disk.used_bytes as f64 / snapshot.disk.total_bytes as f64
        } else {
            0.0
        };

        if disk_ratio >= 0.90 {
            if primary_bottleneck == BottleneckCategory::None {
                primary_bottleneck = BottleneckCategory::DiskPressure;
            }
            issues.push(DiagnosticIssue {
                id: "disk_critical".to_string(),
                severity: DiagnosticSeverity::Critical,
                title: "Root Partition Low Disk Space".to_string(),
                description: format!(
                    "Mount point {mount} is {pct:.1}% full. Running out of disk space prevents system logs and temporary files from saving.",
                    mount = snapshot.disk.mount_point,
                    pct = disk_ratio * 100.0
                ),
                metric: format!("{:.0}% Full", disk_ratio * 100.0),
                remediation: Some(RemediationAction {
                    action_type: "clean_caches".to_string(),
                    label: "Stage Junk to Quarantine".to_string(),
                    description: "Safely stage reclaimable cache targets to free disk space.".to_string(),
                    target: None,
                }),
            });
        }

        // Produce plain-English headline
        let headline = match primary_bottleneck {
            BottleneckCategory::None => {
                if issues.is_empty() {
                    "System performance is optimal. All telemetry indicators are nominal.".to_string()
                } else {
                    "System is operating well with minor optimizations available.".to_string()
                }
            }
            BottleneckCategory::ThermalThrottling => {
                "CPU is overheating and thermal throttling. Heavy compute operations are throttled.".to_string()
            }
            BottleneckCategory::CpuSaturation => {
                "Processor saturation detected. Multiple tasks are contending for CPU cycles.".to_string()
            }
            BottleneckCategory::MemoryPressure => {
                "High memory pressure is forcing disk paging. Freeing caches will improve responsiveness.".to_string()
            }
            BottleneckCategory::DiskPressure => {
                "Storage is nearly full. Low disk head room is degrading filesystem write speeds.".to_string()
            }
            BottleneckCategory::BackgroundIndexer => {
                "Background search indexing is consuming high CPU and storage bandwidth.".to_string()
            }
        };

        let mut recommendations = Vec::new();
        if issues.is_empty() {
            recommendations.push(
                "Keep system packages updated to maintain peak driver efficiency.".to_string(),
            );
        } else {
            recommendations.push(
                "Apply one-click remediations below to instantly relieve bottleneck pressure."
                    .to_string(),
            );
            if mem_ratio > 0.80 {
                recommendations
                    .push("Consider closing unused browser tabs or electron apps.".to_string());
            }
        }

        DiagnosticReport {
            timestamp: snapshot.timestamp,
            health_score,
            primary_bottleneck,
            headline,
            issues,
            recommendations,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sampler::{CpuSnapshot, DiskSnapshot, MemorySnapshot, NetworkSnapshot};

    fn sample_snapshot(
        cpu: f32,
        mem_used: u64,
        mem_total: u64,
        temp: Option<f32>,
    ) -> TelemetrySnapshot {
        TelemetrySnapshot {
            timestamp: 1_700_000_000,
            cpu: CpuSnapshot {
                aggregate_usage_percent: cpu,
                core_count: 8,
                core_usages: vec![cpu; 8],
                frequency_mhz: 3200,
                temperature_celsius: temp,
            },
            memory: MemorySnapshot {
                total_bytes: mem_total,
                used_bytes: mem_used,
                available_bytes: mem_total.saturating_sub(mem_used),
                swap_total_bytes: 4_000_000_000,
                swap_used_bytes: 500_000_000,
            },
            disk: DiskSnapshot {
                mount_point: "/".to_string(),
                total_bytes: 100_000_000_000,
                used_bytes: 50_000_000_000,
                read_bytes_per_sec: 100_000,
                write_bytes_per_sec: 200_000,
            },
            network: NetworkSnapshot {
                interface_name: "wlan0".to_string(),
                download_bytes_per_sec: 50_000,
                upload_bytes_per_sec: 10_000,
            },
        }
    }

    #[test]
    fn test_diagnostics_optimal_system() {
        let snap = sample_snapshot(15.0, 4_000_000_000, 16_000_000_000, Some(45.0));
        let report = DiagnosticEngine::analyze(&snap, 98, &[]);
        assert_eq!(report.primary_bottleneck, BottleneckCategory::None);
        assert!(report.issues.is_empty());
    }

    #[test]
    fn test_diagnostics_memory_pressure() {
        let snap = sample_snapshot(20.0, 15_000_000_000, 16_000_000_000, Some(50.0));
        let report = DiagnosticEngine::analyze(&snap, 60, &[]);
        assert_eq!(
            report.primary_bottleneck,
            BottleneckCategory::MemoryPressure
        );
        assert!(!report.issues.is_empty());
        assert!(report.issues.iter().any(|i| i.id == "memory_critical"));
    }

    #[test]
    fn test_diagnostics_thermal_throttling() {
        let snap = sample_snapshot(90.0, 4_000_000_000, 16_000_000_000, Some(89.0));
        let report = DiagnosticEngine::analyze(&snap, 45, &[]);
        assert_eq!(
            report.primary_bottleneck,
            BottleneckCategory::ThermalThrottling
        );
        assert!(report.issues.iter().any(|i| i.id == "thermal_critical"));
    }

    #[test]
    fn test_diagnostics_indexer_detection() {
        let snap = sample_snapshot(35.0, 4_000_000_000, 16_000_000_000, Some(55.0));
        let procs = vec![
            ("tracker-miner-fs".to_string(), 1234, 25.0, 300_000_000),
            ("code".to_string(), 5678, 10.0, 800_000_000),
        ];
        let report = DiagnosticEngine::analyze(&snap, 80, &procs);
        assert_eq!(
            report.primary_bottleneck,
            BottleneckCategory::BackgroundIndexer
        );
        assert!(
            report
                .issues
                .iter()
                .any(|i| i.id.starts_with("indexer_hog_"))
        );
    }
}
