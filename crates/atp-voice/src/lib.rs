//! `atp-voice` — Local Voice Capture, VAD, and Whisper Speech-to-Text Pipeline.

pub mod capture;
pub mod engine;
pub mod vad;

pub use capture::{AudioCaptureSession, CaptureEvent};
pub use engine::{VoiceError, WhisperEngine, WhisperModelStatus};
pub use vad::{VadConfig, VadDetector, VadState};
