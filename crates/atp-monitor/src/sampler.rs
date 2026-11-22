use std::time::{Instant, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use sysinfo::{Components, Disks, Networks, System};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CpuSnapshot {
    pub aggregate_usage_percent: f32,
    pub core_count: usize,
    pub core_usages: Vec<f32>,
    pub frequency_mhz: u64,
    pub temperature_celsius: Option<f32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemorySnapshot {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiskSnapshot {
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub read_bytes_per_sec: u64,
    pub write_bytes_per_sec: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NetworkSnapshot {
    pub interface_name: String,
    pub download_bytes_per_sec: u64,
    pub upload_bytes_per_sec: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub timestamp: i64,
    pub cpu: CpuSnapshot,
    pub memory: MemorySnapshot,
    pub disk: DiskSnapshot,
    pub network: NetworkSnapshot,
}

pub struct Sampler {
    system: System,
    disks: Disks,
    networks: Networks,
    components: Components,
    last_sample_time: Instant,
    last_net_rx_total: u64,
    last_net_tx_total: u64,
}

impl Default for Sampler {
    fn default() -> Self {
        Self::new()
    }
}

impl Sampler {
    pub fn new() -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        let disks = Disks::new_with_refreshed_list();
        let networks = Networks::new_with_refreshed_list();
        let components = Components::new_with_refreshed_list();

        let (init_rx, init_tx) = Self::aggregate_network(&networks);

        Self {
            system,
            disks,
            networks,
            components,
            last_sample_time: Instant::now(),
            last_net_rx_total: init_rx,
            last_net_tx_total: init_tx,
        }
    }

    pub fn sample(&mut self) -> TelemetrySnapshot {
        let now_instant = Instant::now();
        let elapsed_secs = (now_instant - self.last_sample_time).as_secs_f32().max(0.1);
        self.last_sample_time = now_instant;

        // Refresh system metrics
        self.system.refresh_cpu_all();
        self.system.refresh_memory();
        self.disks.refresh(true);
        self.networks.refresh(true);
        self.components.refresh(true);

        let cpu = self.sample_cpu();
        let memory = self.sample_memory();
        let disk = self.sample_disk();
        let network = self.sample_network(elapsed_secs);

        let now_unix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        TelemetrySnapshot {
            timestamp: now_unix,
            cpu,
            memory,
            disk,
            network,
        }
    }

    fn sample_cpu(&self) -> CpuSnapshot {
        let cpus = self.system.cpus();
        let core_count = cpus.len();
        let core_usages: Vec<f32> = cpus.iter().map(|c| c.cpu_usage()).collect();

        let aggregate_usage_percent = if core_count > 0 {
            core_usages.iter().sum::<f32>() / core_count as f32
        } else {
            self.system.global_cpu_usage()
        };

        let frequency_mhz = if core_count > 0 {
            cpus.iter().map(|c| c.frequency()).sum::<u64>() / core_count as u64
        } else {
            0
        };

        let temperature_celsius = self.sample_temperature();

        CpuSnapshot {
            aggregate_usage_percent,
            core_count,
            core_usages,
            frequency_mhz,
            temperature_celsius,
        }
    }

    fn sample_temperature(&self) -> Option<f32> {
        let mut highest: Option<f32> = None;
        for component in self.components.iter() {
            let label = component.label().to_lowercase();
            if label.contains("cpu") || label.contains("core") || label.contains("package") || label.contains("k10temp") {
                if let Some(temp) = component.temperature() {
                    highest = Some(highest.map_or(temp, |h| h.max(temp)));
                }
            }
        }
        highest
    }

    fn sample_memory(&self) -> MemorySnapshot {
        MemorySnapshot {
            total_bytes: self.system.total_memory(),
            used_bytes: self.system.used_memory(),
            available_bytes: self.system.available_memory(),
            swap_total_bytes: self.system.total_swap(),
            swap_used_bytes: self.system.used_swap(),
        }
    }

    fn sample_disk(&self) -> DiskSnapshot {
        let root_disk = self.disks.iter().find(|d| d.mount_point().to_str() == Some("/"));

        let (total_bytes, used_bytes) = if let Some(d) = root_disk {
            (d.total_space(), d.total_space().saturating_sub(d.available_space()))
        } else if let Some(first) = self.disks.first() {
            (first.total_space(), first.total_space().saturating_sub(first.available_space()))
        } else {
            (0, 0)
        };

        DiskSnapshot {
            mount_point: "/".to_string(),
            total_bytes,
            used_bytes,
            read_bytes_per_sec: 0,
            write_bytes_per_sec: 0,
        }
    }

    fn sample_network(&mut self, elapsed_secs: f32) -> NetworkSnapshot {
        let (current_rx, current_tx) = Self::aggregate_network(&self.networks);

        let rx_delta = current_rx.saturating_sub(self.last_net_rx_total);
        let tx_delta = current_tx.saturating_sub(self.last_net_tx_total);

        self.last_net_rx_total = current_rx;
        self.last_net_tx_total = current_tx;

        let download_bytes_per_sec = (rx_delta as f32 / elapsed_secs) as u64;
        let upload_bytes_per_sec = (tx_delta as f32 / elapsed_secs) as u64;

        let interface_name = self.networks.iter()
            .find(|(name, _)| !name.starts_with("lo") && !name.starts_with("docker") && !name.starts_with("veth"))
            .map(|(name, _)| name.clone())
            .unwrap_or_else(|| "default".to_string());

        NetworkSnapshot {
            interface_name,
            download_bytes_per_sec,
            upload_bytes_per_sec,
        }
    }

    fn aggregate_network(networks: &Networks) -> (u64, u64) {
        let mut total_rx = 0u64;
        let mut total_tx = 0u64;
        for (name, data) in networks.iter() {
            if !name.starts_with("lo") {
                total_rx += data.total_received();
                total_tx += data.total_transmitted();
            }
        }
        (total_rx, total_tx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sampler_produces_realistic_metrics() {
        let mut sampler = Sampler::new();
        let snapshot = sampler.sample();

        assert!(snapshot.cpu.core_count > 0);
        assert!(snapshot.memory.total_bytes > 0);
        assert!(snapshot.disk.total_bytes > 0);
        assert!(snapshot.timestamp > 0);
    }
}
