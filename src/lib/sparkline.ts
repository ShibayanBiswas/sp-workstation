/**
 * Normalize closes to % move from an anchor (session open or first close)
 * so sparklines match today's Live Chart shape and small ranges stay visible.
 */
export function sparklineSeries(
  closes: number[],
  anchor?: number | null
): number[] {
  if (closes.length < 2) return closes.length ? [closes[0], closes[0]] : [0, 0];

  const base =
    anchor != null && Number.isFinite(anchor) && anchor !== 0
      ? anchor
      : closes[0];
  if (!base || Number.isNaN(base)) return closes;

  const indexed = closes.map((v) => ((v - base) / base) * 100);
  const min = Math.min(...indexed);
  const max = Math.max(...indexed);
  const range = max - min;

  // Flat series: inject tiny synthetic spread so the line is not a horizontal bar.
  if (range < 0.0001) {
    return indexed.map((v, i) => v + (i % 2 === 0 ? 0.02 : -0.02));
  }

  return indexed;
}
