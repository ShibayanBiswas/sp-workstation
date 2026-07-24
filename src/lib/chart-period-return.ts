import { istDateString, tradingSessionBars } from "@/lib/chart-ist";
import type { ChartTimeframeId } from "@/lib/chart-timeframes";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

export type ReturnBasis =
  | "day_open"
  | "prev_close"
  | "week_open"
  | "month_open"
  | "lookback_open";

export type PeriodReturn = {
  change: number;
  changePercent: number;
  reference: number;
  basis: ReturnBasis;
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

const BASIS_LABEL: Record<ReturnBasis, string> = {
  day_open: "vs session open",
  prev_close: "vs prev close",
  week_open: "vs week open",
  month_open: "vs month open",
  lookback_open: "vs period open",
};

export function returnBasisLabel(basis: ReturnBasis | null | undefined): string {
  if (!basis) return "";
  return BASIS_LABEL[basis];
}

/** Monday 00:00 IST of the week containing `unixSec`. */
function startOfIstWeekUnix(unixSec: number): number {
  const dateStr = istDateString(unixSec);
  const weekday = new Date(`${dateStr}T12:00:00+05:30`).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const mondayStr = istDateString(unixSec - daysFromMonday * 86_400);
  return Math.floor(new Date(`${mondayStr}T00:00:00+05:30`).getTime() / 1000);
}

/** 1st of the IST calendar month containing `unixSec`, at 00:00 IST. */
function startOfIstMonthUnix(unixSec: number): number {
  const dateStr = istDateString(unixSec);
  const monthStart = `${dateStr.slice(0, 8)}01`;
  return Math.floor(new Date(`${monthStart}T00:00:00+05:30`).getTime() / 1000);
}

function firstBarAtOrAfter(bars: OhlcBar[], cutoffUnix: number): OhlcBar {
  return bars.find((b) => b.time >= cutoffUnix) ?? bars[0];
}

/** Open of the active / last completed trading session. */
function sessionDayOpen(bars: OhlcBar[]): number | null {
  if (bars.length === 0) return null;
  const dayBars = tradingSessionBars(bars);
  const open = (dayBars[0] ?? bars[bars.length - 1]).open;
  return Number.isFinite(open) && open !== 0 ? open : null;
}

function buildReturn(
  currentPrice: number,
  reference: number,
  basis: ReturnBasis
): PeriodReturn | null {
  if (!Number.isFinite(reference) || reference === 0) return null;
  const change = currentPrice - reference;
  const changePercent = (change / reference) * 100;
  return { change, changePercent, reference, basis };
}

/**
 * Timeframe return vs period open (start → now):
 * - 1D → today's session open (headline % + Open line + sparklines)
 * - 1W → open of first bar in the current IST week
 * - 1M → open of first bar in the current IST calendar month
 * - 3M+ → open of first bar at/after lookback cutoff
 *
 * Optional `dayOpen` (from the live quote) is preferred for 1D so the chart
 * Open reference matches Snapshot sparklines.
 */
export function computeTimeframeReturn(
  bars: OhlcBar[],
  timeframeId: ChartTimeframeId,
  currentPrice: number,
  dayOpen?: number | null
): PeriodReturn | null {
  if (!bars.length || !Number.isFinite(currentPrice)) return null;

  const last = bars[bars.length - 1];

  switch (timeframeId) {
    case "1D": {
      const ref =
        dayOpen != null && Number.isFinite(dayOpen) && dayOpen !== 0
          ? dayOpen
          : sessionDayOpen(bars);
      if (ref == null) return null;
      return buildReturn(currentPrice, ref, "day_open");
    }
    case "1W": {
      const weekStart = startOfIstWeekUnix(last.time);
      const weekBars = bars.filter((b) => b.time >= weekStart);
      const referenceBar = weekBars[0] ?? bars[0];
      return buildReturn(currentPrice, referenceBar.open, "week_open");
    }
    case "1M": {
      const monthStart = startOfIstMonthUnix(last.time);
      const referenceBar = firstBarAtOrAfter(bars, monthStart);
      return buildReturn(currentPrice, referenceBar.open, "month_open");
    }
    case "3M":
    case "6M":
    case "1Y":
    case "5Y": {
      const cutoff = last.time - LOOKBACK_SEC[timeframeId];
      const referenceBar = firstBarAtOrAfter(bars, cutoff);
      return buildReturn(currentPrice, referenceBar.open, "lookback_open");
    }
    default: {
      const _exhaustive: never = timeframeId;
      return _exhaustive;
    }
  }
}
