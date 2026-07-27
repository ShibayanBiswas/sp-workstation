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

function resolveNowUnix(now?: Date | number): number {
  if (now == null) return Math.floor(Date.now() / 1000);
  if (typeof now === "number") return now;
  return Math.floor(now.getTime() / 1000);
}

/** Monday 00:00 IST of the week containing `unixSec`. */
export function startOfIstWeekUnix(unixSec: number): number {
  const dateStr = istDateString(unixSec);
  const weekday = new Date(`${dateStr}T12:00:00+05:30`).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const mondayStr = istDateString(unixSec - daysFromMonday * 86_400);
  return Math.floor(new Date(`${mondayStr}T00:00:00+05:30`).getTime() / 1000);
}

/** 1st of the IST calendar month containing `unixSec`, at 00:00 IST. */
export function startOfIstMonthUnix(unixSec: number): number {
  const dateStr = istDateString(unixSec);
  const monthStart = `${dateStr.slice(0, 8)}01`;
  return Math.floor(new Date(`${monthStart}T00:00:00+05:30`).getTime() / 1000);
}

function barsFromCutoff(bars: OhlcBar[], cutoffUnix: number): OhlcBar[] {
  const sliced = bars.filter((b) => b.time >= cutoffUnix);
  return sliced.length > 0 ? sliced : bars.slice(-1);
}

/**
 * Zoom Off window: bars from the period start → latest print.
 *
 * - 1D → trading session from open (today, else last session)
 * - 1W → IST week from Monday (current week if any prints, else last week)
 * - 1M → IST calendar month from the 1st (current month if any, else last)
 * - 3M / 6M / 1Y / 5Y → rolling lookback from the latest print
 *
 * Zoom On keeps the full fetched series (do not call this).
 */
export function timeframePeriodBars(
  bars: OhlcBar[],
  timeframeId: ChartTimeframeId,
  opts?: { now?: Date | number }
): OhlcBar[] {
  if (bars.length === 0) return [];

  const last = bars[bars.length - 1]!;
  const nowUnix = resolveNowUnix(opts?.now);

  switch (timeframeId) {
    case "1D":
      return tradingSessionBars(bars, { now: opts?.now });
    case "1W": {
      const current = bars.filter((b) => b.time >= startOfIstWeekUnix(nowUnix));
      if (current.length > 0) return current;
      return barsFromCutoff(bars, startOfIstWeekUnix(last.time));
    }
    case "1M": {
      const current = bars.filter((b) => b.time >= startOfIstMonthUnix(nowUnix));
      if (current.length > 0) return current;
      return barsFromCutoff(bars, startOfIstMonthUnix(last.time));
    }
    case "3M":
    case "6M":
    case "1Y":
    case "5Y":
      return barsFromCutoff(bars, last.time - LOOKBACK_SEC[timeframeId]);
    default: {
      const _exhaustive: never = timeframeId;
      return _exhaustive;
    }
  }
}

/** Open of the active / last completed trading session. */
function sessionDayOpen(bars: OhlcBar[]): number | null {
  if (bars.length === 0) return null;
  const dayBars = tradingSessionBars(bars);
  const open = (dayBars[0] ?? bars[bars.length - 1]!).open;
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

function basisForTimeframe(timeframeId: ChartTimeframeId): ReturnBasis {
  switch (timeframeId) {
    case "1D":
      return "day_open";
    case "1W":
      return "week_open";
    case "1M":
      return "month_open";
    case "3M":
    case "6M":
    case "1Y":
    case "5Y":
      return "lookback_open";
    default: {
      const _exhaustive: never = timeframeId;
      return _exhaustive;
    }
  }
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

  if (timeframeId === "1D") {
    const ref =
      dayOpen != null && Number.isFinite(dayOpen) && dayOpen !== 0
        ? dayOpen
        : sessionDayOpen(bars);
    if (ref == null) return null;
    return buildReturn(currentPrice, ref, "day_open");
  }

  const periodBars = timeframePeriodBars(bars, timeframeId);
  const referenceBar = periodBars[0] ?? bars[0]!;
  return buildReturn(
    currentPrice,
    referenceBar.open,
    basisForTimeframe(timeframeId)
  );
}
