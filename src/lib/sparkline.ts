/**
 * Normalize closes to % move from session open (anchor) so sparklines match
 * the Live Chart 1D path: open → intraday → now. Value 0 = open level.
 */
export function sparklineSeries(
  closes: number[],
  anchor?: number | null
): number[] {
  if (closes.length < 2) return closes.length ? [0, 0] : [0, 0];

  const base =
    anchor != null && Number.isFinite(anchor) && anchor !== 0
      ? anchor
      : closes[0];
  if (!base || Number.isNaN(base)) return closes.map(() => 0);

  const indexed = closes.map((v) => ((v - base) / base) * 100);
  const min = Math.min(...indexed);
  const max = Math.max(...indexed);
  const range = max - min;

  // Truly flat session: tiny synthetic wobble so the stroke still draws.
  if (range < 0.0001) {
    return indexed.map((v, i) => v + (i % 2 === 0 ? 0.02 : -0.02));
  }

  return indexed;
}
