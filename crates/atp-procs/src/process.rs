use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessEntry {
    pub pid: u32,
    pub name: String,
    pub display_name: String,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub io_read_bytes_per_sec: u64,
    pub is_critical: bool,
}
