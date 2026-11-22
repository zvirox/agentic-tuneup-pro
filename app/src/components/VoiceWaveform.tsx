import React from "react";

interface VoiceWaveformProps {
  levels: number[]; // 16 normalized frequency/amplitude values between 0.0 and 1.0
  isActive: boolean;
  className?: string;
}

/**
 * High-performance 16-band audio waveform visualizer for real-time speech capture.
 * Accented with Electric Cyan and Violet gradient bars.
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
      className={`flex items-center justify-center gap-1 h-8 px-3 py-1 bg-[#0E131B]/80 rounded-lg border border-white/10 ${className}`}
    >
      {bars.map((amplitude, index) => {
        // Height scaled from min 12% to max 100%
        const normalizedHeight = isActive
          ? Math.max(12, Math.min(100, Math.round(amplitude * 100)))
          : 12;

        // Alternate or gradient styling from Cyan to Violet
        const isCyan = index % 2 === 0;

        return (
          <div
            key={index}
            className="w-1 rounded-full transition-all duration-75 ease-out"
            style={{
              height: `${normalizedHeight}%`,
              backgroundColor: isCyan ? "#38BDF8" : "#A855F7",
              boxShadow: isActive && normalizedHeight > 30
                ? isCyan
                  ? "0 0 8px rgba(56, 189, 248, 0.4)"
                  : "0 0 8px rgba(168, 85, 247, 0.4)"
                : "none",
            }}
          />
        );
      })}
    </div>
  );
};
