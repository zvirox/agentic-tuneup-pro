//! Voice Activity Detection (VAD) using Short-Time RMS Energy Thresholding.

use serde::{Deserialize, Serialize};

/// Configuration for energy-based Voice Activity Detection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VadConfig {
    /// Minimum RMS amplitude required to trigger speech onset (0.0 to 1.0).
    pub energy_threshold: f32,
    /// Number of consecutive active frames required to transition to Speech.
    pub speech_frames_threshold: usize,
    /// Number of consecutive silent frames required to trigger Speech end.
    pub silence_frames_threshold: usize,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            energy_threshold: 0.025,
            speech_frames_threshold: 3,
            silence_frames_threshold: 15,
        }
    }
}

/// Current state of the VAD detector.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VadState {
    Silence,
    SpeechDetected,
}

/// Detector that processes contiguous audio frames and detects speech boundaries.
pub struct VadDetector {
    config: VadConfig,
    state: VadState,
    consecutive_speech_frames: usize,
    consecutive_silence_frames: usize,
}

impl VadDetector {
    pub fn new(config: VadConfig) -> Self {
        Self {
            config,
            state: VadState::Silence,
            consecutive_speech_frames: 0,
            consecutive_silence_frames: 0,
        }
    }

    /// Computes Root Mean Square (RMS) energy of an audio slice.
    pub fn calculate_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        let sum_sq: f32 = samples.iter().map(|&s| s * s).sum();
        (sum_sq / samples.len() as f32).sqrt()
    }

    /// Processes an audio frame and returns whether speech is currently active.
    pub fn process_frame(&mut self, samples: &[f32]) -> (VadState, f32) {
        let rms = Self::calculate_rms(samples);
        let is_loud_enough = rms >= self.config.energy_threshold;

        if is_loud_enough {
            self.consecutive_speech_frames += 1;
            self.consecutive_silence_frames = 0;
            if self.consecutive_speech_frames >= self.config.speech_frames_threshold {
                self.state = VadState::SpeechDetected;
            }
        } else {
            self.consecutive_silence_frames += 1;
            self.consecutive_speech_frames = 0;
            if self.consecutive_silence_frames >= self.config.silence_frames_threshold {
                self.state = VadState::Silence;
            }
        }

        (self.state, rms)
    }

    pub fn current_state(&self) -> VadState {
        self.state
    }

    pub fn reset(&mut self) {
        self.state = VadState::Silence;
        self.consecutive_speech_frames = 0;
        self.consecutive_silence_frames = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_rms() {
        assert_eq!(VadDetector::calculate_rms(&[]), 0.0);
        let silence = vec![0.0; 100];
        assert_eq!(VadDetector::calculate_rms(&silence), 0.0);
        let tone = vec![0.5; 100];
        let rms = VadDetector::calculate_rms(&tone);
        assert!((rms - 0.5).abs() < 1e-5);
    }

    #[test]
    fn test_vad_transition_lifecycle() {
        let mut vad = VadDetector::new(VadConfig {
            energy_threshold: 0.1,
            speech_frames_threshold: 2,
            silence_frames_threshold: 3,
        });

        assert_eq!(vad.current_state(), VadState::Silence);

        // Frame 1 loud
        let loud_frame = vec![0.2; 128];
        let (state, _) = vad.process_frame(&loud_frame);
        assert_eq!(state, VadState::Silence); // Not yet at threshold 2

        // Frame 2 loud -> becomes speech
        let (state, _) = vad.process_frame(&loud_frame);
        assert_eq!(state, VadState::SpeechDetected);

        // Silent frames
        let silent_frame = vec![0.01; 128];
        vad.process_frame(&silent_frame); // 1
        vad.process_frame(&silent_frame); // 2
        let (state, _) = vad.process_frame(&silent_frame); // 3 -> becomes silence
        assert_eq!(state, VadState::Silence);
    }
}
