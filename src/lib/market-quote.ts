/** Shared quote normalization + display formatting for tape, cards, and chart. */

export type NormalizedQuote = {
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  marketTime?: number;
};

export function priceDigitsForIndex(indexId: string): number {
  if (indexId === "usdinr") return 4;
  return 2;
}

function roundTo(n: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

/** Recompute change/return from price vs previous close so all surfaces match. */
export function normalizeLiveQuote(raw: {
  price: number;
  previousClose: number;
  marketTime?: number;
}): NormalizedQuote {
  const price = raw.price;
  const previousClose = raw.previousClose;
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

  return {
    price,
    change,
    changePercent,
    previousClose,
    marketTime: raw.marketTime,
  };
}

export function formatMarketPrice(
  value: number | null | undefined,
  indexId?: string
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const digits = indexId ? priceDigitsForIndex(indexId) : 2;
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatMarketChange(
  value: number | null | undefined,
  indexId?: string
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const digits = indexId ? priceDigitsForIndex(indexId) : 2;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatMarketChangePercent(
  value: number | null | undefined
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${roundTo(value, 2).toFixed(2)}%`;
}

export function formatIstSyncTime(isoOrUnix?: string | number): string {
  if (!isoOrUnix) return "";
  const d =
    typeof isoOrUnix === "number" ? new Date(isoOrUnix * 1000) : new Date(isoOrUnix);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
