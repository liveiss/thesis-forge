'use client';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showLabel?: boolean;
}

export default function ScoreRing({
  score,
  size = 48,
  strokeWidth = 4,
  label,
  showLabel = true,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(Math.max(score, 0), 100) / 100;
  const dashoffset = circumference * (1 - progress);

  const color =
    score >= 85
      ? '#22c55e'
      : score >= 60
        ? '#f59e0b'
        : '#ef4444';

  const bgColor =
    score >= 85
      ? 'rgba(34,197,94,0.1)'
      : score >= 60
        ? 'rgba(245,158,11,0.1)'
        : 'rgba(239,68,68,0.1)';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-medium)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center rounded-full"
          style={{ backgroundColor: bgColor }}
        >
          <span
            className="font-bold text-xs"
            style={{ color }}
          >
            {score}
          </span>
        </div>
      </div>
      {showLabel && label && (
        <span className="text-[10px] text-theme-dim whitespace-nowrap">{label}</span>
      )}
    </div>
  );
}
