import { istDateString } from "@/lib/chart-ist";
import type { ChartTimeframeId } from "@/lib/chart-timeframes";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

export type PeriodReturn = {
  change: number;
  changePercent: number;
  reference: number;
};

/** Approximate lookback in seconds for multi-month/year timeframes. */
const LOOKBACK_SEC: Record<
  Exclude<ChartTimeframeId, "1D" | "1W" | "1M">,
  number
> = {
  "3M": 90 * 24 * 3600,
  "6M": 180 * 24 * 3600,
  "1Y": 365 * 24 * 3600,
  "5Y": 5 * 365 * 24 * 3600,
};

/** Monday 00:00 IST of the week containing `unixSec`. */
function startOfIstWeekUnix(unixSec: number): number {
  const dateStr = istDateString(unixSec);
  const weekday = new Date(`${dateStr}T12:00:00+05:30`).getUTCDay();
  // Sunday=0 … Saturday=6; days since Monday:
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const mondayStr = istDateString(unixSec - daysFromMonday * 86_400);
  return Math.floor(new Date(`${mondayStr}T00:00:00+05:30`).getTime() / 1000);
}

/** 1st of the IST calendar month containing `unixSec`, at 00:00 IST. */
function startOfIstMonthUnix(unixSec: number): number {
  const dateStr = istDateString(unixSec); // YYYY-MM-DD
  const monthStart = `${dateStr.slice(0, 8)}01`;
  return Math.floor(new Date(`${monthStart}T00:00:00+05:30`).getTime() / 1000);
}

function firstBarAtOrAfter(bars: OhlcBar[], cutoffUnix: number): OhlcBar {
  return bars.find((b) => b.time >= cutoffUnix) ?? bars[0];
}

/**
 * Reference (open) price for the selected chart timeframe:
 * - 1D → open of the latest trading session (IST day)
 * - 1W → open of the first bar in the current IST week (Mon–Sun)
 * - 1M → open of the first bar in the current IST calendar month
 * - 3M+ → open of the first bar at/after the lookback cutoff
 *
 * Change = currentPrice − reference. During the session this is open→now;
 * after the close it is open→close for that period.
 */
export function computeTimeframeReturn(
  bars: OhlcBar[],
  timeframeId: ChartTimeframeId,
  currentPrice: number
): PeriodReturn | null {
  if (!bars.length || !Number.isFinite(currentPrice)) return null;

  const last = bars[bars.length - 1];
  let referenceBar: OhlcBar | undefined;

  switch (timeframeId) {
    case "1D": {
      const day = istDateString(last.time);
      const dayBars = bars.filter((b) => istDateString(b.time) === day);
      referenceBar = dayBars[0] ?? last;
      break;
    }
    case "1W": {
      const weekStart = startOfIstWeekUnix(last.time);
      const weekBars = bars.filter((b) => b.time >= weekStart);
      referenceBar = weekBars[0] ?? bars[0];
      break;
    }
    case "1M": {
      const monthStart = startOfIstMonthUnix(last.time);
      referenceBar = firstBarAtOrAfter(bars, monthStart);
      break;
    }
    case "3M":
    case "6M":
    case "1Y":
    case "5Y": {
      const cutoff = last.time - LOOKBACK_SEC[timeframeId];
      referenceBar = firstBarAtOrAfter(bars, cutoff);
      break;
    }
    default: {
      const _exhaustive: never = timeframeId;
      return _exhaustive;
    }
  }

  if (!referenceBar) return null;
  const reference = referenceBar.open;
  if (!Number.isFinite(reference) || reference === 0) return null;

  const change = currentPrice - reference;
  const changePercent = (change / reference) * 100;
  return { change, changePercent, reference };
}
