import React from "react";

interface VoiceWaveformProps {
  levels: number[];
  isActive: boolean;
  className?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  levels,
  isActive,
  className = "",
}) => {
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
      aria-label="Voice preview waveform"
      className={`flex items-center justify-center gap-1 h-7 px-2.5 py-1 bg-[var(--bg-surface-2)] rounded-md border border-[var(--border)] ${className}`}
    >
      {bars.map((amplitude, index) => {
        const scale = isActive ? Math.max(0.12, Math.min(1, amplitude)) : 0.12;

        return (
          <div
            key={index}
            className="w-1 h-full rounded-[2px] bg-primary origin-center transition-transform duration-150 ease-out"
            style={{ transform: `scaleY(${scale})` }}
          />
        );
      })}
    </div>
  );
};
