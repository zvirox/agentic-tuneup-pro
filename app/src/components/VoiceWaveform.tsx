import React from "react";

interface VoiceWaveformProps {
  levels: number[]; // 16 normalized frequency/amplitude values between 0.0 and 1.0
  isActive: boolean;
  className?: string;
}

/**
 * 16-band audio waveform visualizer for real-time speech capture.
 * One accent, no glow — the live signal is the only thing moving.
 */
export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  levels,
  isActive,
  className = "",
}) => {
  // Ensure we always have 16 bars
  const bars = React.useMemo(() => {
    if (levels.length >= 16) {
      return levels.slice(0, 16);
    }
    const padded = [...levels];
    while (padded.length < 16) {
      padded.push(0.08);
    }
    return padded;
  }, [levels]);

  return (
    <div
      role="img"
      aria-label="Live voice input waveform"
      className={`flex items-center justify-center gap-1 h-8 px-3 py-1 bg-raised/80 rounded-lg border border-border-subtle ${className}`}
    >
      {bars.map((amplitude, index) => {
        // Scale the bar from its centre so only the transform animates
        const scale = isActive
          ? Math.max(0.12, Math.min(1, amplitude))
          : 0.12;

        return (
          <div
            key={index}
            className="w-1 h-full rounded-full bg-accent origin-center transition-transform duration-75 ease-out"
            style={{ transform: `scaleY(${scale})` }}
          />
        );
      })}
    </div>
  );
};
