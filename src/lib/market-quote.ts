/** Shared quote normalization + display formatting for tape, cards, and chart. */

export type NormalizedQuote = {
  price: number;
  change: number;
  changePercent: number;
  /** Today's session open (sparklines / chart open line). */
  dayOpen: number;
  /** Previous session close — Zerodha / NSE day-change basis. */
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

/**
 * Day P&L vs previous close (Zerodha Kite default / NSE headline %).
 * `dayOpen` is kept for sparklines and the chart Open reference line.
 */
export function normalizeLiveQuote(raw: {
  price: number;
  dayOpen: number;
  previousClose: number;
  marketTime?: number;
}): NormalizedQuote {
  const price = raw.price;
  const dayOpen = raw.dayOpen;
  const previousClose = raw.previousClose;
  const change = price - previousClose;
  const changePercent =
    previousClose !== 0 ? (change / previousClose) * 100 : 0;

  return {
    price,
    change,
    changePercent,
    dayOpen,
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

/** Time (+ short date when not today IST, or when forceDate). */
export function formatIstSessionStamp(
  isoOrUnix?: string | number,
  opts?: { forceDate?: boolean }
): string {
  if (!isoOrUnix) return "";
  const d =
    typeof isoOrUnix === "number"
      ? new Date(isoOrUnix * 1000)
      : new Date(isoOrUnix);
  if (Number.isNaN(d.getTime())) return "";

  const todayIst = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  const stampIst = d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  const time = formatIstSyncTime(isoOrUnix);
  if (!time) return "";

  if (!opts?.forceDate && stampIst === todayIst) return time;

  const day = d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${day}, ${time}`;
}
