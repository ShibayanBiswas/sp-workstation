type Props = {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
};

export function Sparkline({
  data,
  positive = true,
  width = 120,
  height = 36,
}: Props) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "var(--success)" : "var(--danger)";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polyline
        fill={`color-mix(in srgb, ${color} 12%, transparent)`}
        stroke="none"
        points={`${pad},${height} ${points} ${width - pad},${height}`}
      />
    </svg>
  );
}
