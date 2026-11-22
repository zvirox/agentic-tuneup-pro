use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, RwLock};
use crate::ring_buffer::RingBuffer;
use crate::sampler::{Sampler, TelemetrySnapshot};

#[derive(Clone)]
pub struct TelemetryMonitor {
    ring_buffer: Arc<RwLock<RingBuffer<TelemetrySnapshot>>>,
    sampler: Arc<RwLock<Sampler>>,
    tx: broadcast::Sender<TelemetrySnapshot>,
}

impl Default for TelemetryMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl TelemetryMonitor {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(32);
        Self {
            ring_buffer: Arc::new(RwLock::new(RingBuffer::new(300))),
            sampler: Arc::new(RwLock::new(Sampler::new())),
            tx,
        }
    }

    /// Triggers an immediate sample, appends to the ring buffer, and broadcasts.
    pub async fn sample_now(&self) -> TelemetrySnapshot {
        let mut sampler = self.sampler.write().await;
        let snapshot = sampler.sample();
        let mut rb = self.ring_buffer.write().await;
        rb.push(snapshot.clone());
        let _ = self.tx.send(snapshot.clone());
        snapshot
    }

    /// Retrieves the most recent snapshot. If buffer is empty, samples immediately.
    pub async fn get_latest(&self) -> TelemetrySnapshot {
        let rb = self.ring_buffer.read().await;
        if let Some(latest) = rb.latest() {
            latest.clone()
        } else {
            drop(rb);
            self.sample_now().await
        }
    }

    /// Retrieves historical snapshots up to `limit` entries.
    pub async fn get_history(&self, limit: usize) -> Vec<TelemetrySnapshot> {
        let rb = self.ring_buffer.read().await;
        rb.history(limit)
    }

    /// Subscribes to the live broadcast channel.
    pub fn subscribe(&self) -> broadcast::Receiver<TelemetrySnapshot> {
        self.tx.subscribe()
    }

    /// Launches the background Tokio sampling loop if a runtime is active.
    pub fn start_sampling_loop(&self, interval_ms: u64) -> Option<tokio::task::JoinHandle<()>> {
        if tokio::runtime::Handle::try_current().is_err() {
            return None;
        }
        let monitor = self.clone();
        Some(tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(interval_ms));
            loop {
                interval.tick().await;
                monitor.sample_now().await;
            }
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sampling_loop_outside_runtime_returns_none() {
        let monitor = TelemetryMonitor::new();
        let handle = monitor.start_sampling_loop(100);
        assert!(handle.is_none());
    }

    #[tokio::test]
    async fn test_sampling_loop_inside_runtime() {
        let monitor = TelemetryMonitor::new();
        let handle = monitor.start_sampling_loop(20);
        assert!(handle.is_some());
        tokio::time::sleep(Duration::from_millis(60)).await;
        handle.unwrap().abort();
        let history = monitor.get_history(10).await;
        assert!(!history.is_empty());
    }

    #[tokio::test]
    async fn test_telemetry_monitor_sampling_and_history() {
        let monitor = TelemetryMonitor::new();
        let snapshot = monitor.sample_now().await;

        assert!(snapshot.cpu.core_count > 0);

        let latest = monitor.get_latest().await;
        assert_eq!(latest.timestamp, snapshot.timestamp);

        let history = monitor.get_history(10).await;
        assert_eq!(history.len(), 1);
    }
}
