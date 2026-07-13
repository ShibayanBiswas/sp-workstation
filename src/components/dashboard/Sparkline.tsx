"use client";

import { useId } from "react";

type Props = {
  data: number[];
  up: boolean;
  width?: number;
  height?: number;
  className?: string;
  showArea?: boolean;
  strokeWidth?: number;
};

export function Sparkline({
  data,
  up,
  width = 120,
  height = 36,
  className = "",
  showArea = true,
  strokeWidth = 1.75,
}: Props) {
  const gradientId = useId().replace(/:/g, "");
  const points =
    data.length > 1
      ? data
      : data.length === 1
        ? [data[0], data[0]]
        : [1, 1];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 2;

  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const linePath = coords
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${height - pad} L${coords[0].x},${height - pad} Z`;
  const stroke = up ? "#089981" : "#f23645";
  const polylinePoints = coords.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-hidden
    >
      {showArea ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
      ) : null}
      {showArea ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polylinePoints}
      />
    </svg>
  );
}
