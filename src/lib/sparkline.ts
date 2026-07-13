/** Normalize closes to % move from first point so small ranges still render visibly. */
export function sparklineSeries(closes: number[]): number[] {
  if (closes.length < 2) return closes.length ? [closes[0], closes[0]] : [0, 0];

  const base = closes[0];
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
