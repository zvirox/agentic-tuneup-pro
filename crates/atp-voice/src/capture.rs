//! Audio Capture Session and Waveform Analysis.

use crate::vad::{VadConfig, VadDetector, VadState};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::broadcast;

/// Emitted by the audio capture stream for UI rendering and agent ingestion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum CaptureEvent {
    /// 16-band normalized energy spectrum (0.0 to 1.0) for the live audio visualizer.
    Waveform([f32; 16]),
    /// Voice activity changed (e.g. user started speaking or paused).
    StateChange(VadState),
    /// Complete utterance recorded and ready for transcription.
    UtteranceReady {
        sample_count: usize,
        duration_ms: u64,
    },
    /// Recording session finished or aborted.
    Finished,
}

/// Manages active voice recording session and spectrum analysis.
pub struct AudioCaptureSession {
    is_running: Arc<AtomicBool>,
    event_tx: broadcast::Sender<CaptureEvent>,
}

impl AudioCaptureSession {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(128);
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            event_tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<CaptureEvent> {
        self.event_tx.subscribe()
    }

    pub fn is_active(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Stops the current recording loop.
    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
        let _ = self.event_tx.send(CaptureEvent::Finished);
    }

    /// Generates a synthetic 16-band waveform from an audio frame and RMS energy.
    pub fn compute_spectrum(samples: &[f32], rms: f32) -> [f32; 16] {
        let mut bands = [0.0f32; 16];
        if samples.is_empty() {
            return bands;
        }

        let chunk_size = (samples.len() / 16).max(1);
        for (i, band) in bands.iter_mut().enumerate() {
            let start = i * chunk_size;
            let end = (start + chunk_size).min(samples.len());
            if start < samples.len() {
                let sub_rms = VadDetector::calculate_rms(&samples[start..end]);
                // Boost and clamp for responsive UI visualizer
                *band = ((sub_rms * 2.5) + (rms * 0.5)).clamp(0.05, 1.0);
            } else {
                *band = 0.05;
            }
        }
        bands
    }

    /// Simulates or captures an audio stream loop in background.
    pub fn start_simulated_stream(&self, duration_ms: u64) -> tokio::task::JoinHandle<Vec<f32>> {
        self.is_running.store(true, Ordering::SeqCst);
        let running = self.is_running.clone();
        let tx = self.event_tx.clone();

        tokio::spawn(async move {
            let mut captured_samples = Vec::new();
            let mut vad = VadDetector::new(VadConfig::default());
            let interval_ms = 40; // 25 Hz visualizer rate
            let iterations = duration_ms / interval_ms;

            for i in 0..iterations {
                if !running.load(Ordering::SeqCst) {
                    break;
                }

                // Simulate realistic speech modulation
                let energy = if (10..iterations.saturating_sub(10)).contains(&i) {
                    0.25 + 0.15 * ((i as f32 * 0.4).sin().abs())
                } else {
                    0.01 // silence at edges
                };

                let frame_len = 160;
                let frame: Vec<f32> = (0..frame_len)
                    .map(|k| energy * ((k as f32 * 0.2).sin()))
                    .collect();

                let (state, rms) = vad.process_frame(&frame);
                let spectrum = Self::compute_spectrum(&frame, rms);

                let _ = tx.send(CaptureEvent::Waveform(spectrum));
                let _ = tx.send(CaptureEvent::StateChange(state));

                captured_samples.extend_from_slice(&frame);
                tokio::time::sleep(tokio::time::Duration::from_millis(interval_ms)).await;
            }

            running.store(false, Ordering::SeqCst);
            let _ = tx.send(CaptureEvent::UtteranceReady {
                sample_count: captured_samples.len(),
                duration_ms,
            });
            let _ = tx.send(CaptureEvent::Finished);

            captured_samples
        })
    }
}

impl Default for AudioCaptureSession {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_audio_capture_session_lifecycle() {
        let session = AudioCaptureSession::new();
        assert!(!session.is_active());

        let mut rx = session.subscribe();
        let handle = session.start_simulated_stream(120);
        assert!(session.is_active());

        let mut received_waveform = false;
        while let Ok(evt) = rx.recv().await {
            if let CaptureEvent::Waveform(w) = evt {
                assert_eq!(w.len(), 16);
                received_waveform = true;
                break;
            }
        }
        assert!(received_waveform);

        let samples = handle.await.unwrap();
        assert!(!samples.is_empty());
        assert!(!session.is_active());
    }
}
