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

/** Zoom Off chart window starts this many prior periods before the active one. */
export const ZOOM_OFF_VIEW_OFFSET = 1;

/** 1M / 3M keep a wider Zoom Off window; all other TFs use offset 1. */
export function zoomOffViewOffset(timeframeId: ChartTimeframeId): number {
  switch (timeframeId) {
    case "1M":
    case "3M":
      return 2;
    case "1D":
    case "1W":
    case "6M":
    case "1Y":
    case "5Y":
      return ZOOM_OFF_VIEW_OFFSET;
    default: {
      const _exhaustive: never = timeframeId;
      return _exhaustive;
    }
  }
}

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

function shiftIstWeeks(fromUnix: number, weeks: number): number {
  if (weeks <= 0) return startOfIstWeekUnix(fromUnix);
  return startOfIstWeekUnix(fromUnix - weeks * 7 * 86_400);
}

function shiftIstMonths(fromUnix: number, months: number): number {
  if (months <= 0) return startOfIstMonthUnix(fromUnix);
  const dateStr = istDateString(fromUnix);
  const [y, m] = dateStr.split("-").map(Number);
  let month = m - months;
  let year = y;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  return Math.floor(new Date(`${monthStart}T00:00:00+05:30`).getTime() / 1000);
}

function uniqueIstTradingDays(bars: OhlcBar[]): string[] {
  return [...new Set(bars.map((b) => istDateString(b.time)))].sort();
}

function viewStartFromTradingDays(
  bars: OhlcBar[],
  anchorDay: string,
  daysBack: number
): number {
  const days = uniqueIstTradingDays(bars);
  const idx = days.indexOf(anchorDay);
  const anchorIdx = idx >= 0 ? idx : Math.max(days.length - 1, 0);
  const startIdx = Math.max(0, anchorIdx - daysBack);
  const dayStr = days[startIdx] ?? anchorDay;
  return Math.floor(new Date(`${dayStr}T00:00:00+05:30`).getTime() / 1000);
}

function currentWeekAnchorUnix(bars: OhlcBar[], nowUnix: number): number {
  const current = bars.filter((b) => b.time >= startOfIstWeekUnix(nowUnix));
  if (current.length > 0) return startOfIstWeekUnix(nowUnix);
  return startOfIstWeekUnix(bars[bars.length - 1]!.time);
}

function currentMonthAnchorUnix(bars: OhlcBar[], nowUnix: number): number {
  const current = bars.filter((b) => b.time >= startOfIstMonthUnix(nowUnix));
  if (current.length > 0) return startOfIstMonthUnix(nowUnix);
  return startOfIstMonthUnix(bars[bars.length - 1]!.time);
}

/**
 * Zoom Off window: bars from the period start → latest print.
 *
 * - 1D → trading session from open (today, else last session)
 * - 1W → IST week from Monday (current week if any prints, else last week)
 * - 1M → IST calendar month from the 1st (current month if any, else last)
 * - 3M / 6M / 1Y / 5Y → rolling lookback from the latest print
 *
 * Pass `viewOffset` (default 0) to start the chart earlier — e.g. 2 for the
 * 2nd-last week / month / lookback block while keeping period returns on the
 * active window via `computeTimeframeReturn`.
 *
 * Zoom On keeps the full fetched series (do not call this).
 */
export function timeframePeriodBars(
  bars: OhlcBar[],
  timeframeId: ChartTimeframeId,
  opts?: { now?: Date | number; viewOffset?: number }
): OhlcBar[] {
  if (bars.length === 0) return [];

  const last = bars[bars.length - 1]!;
  const nowUnix = resolveNowUnix(opts?.now);
  const viewOffset = Math.max(0, opts?.viewOffset ?? 0);

  switch (timeframeId) {
    case "1D": {
      const session = tradingSessionBars(bars, { now: opts?.now });
      if (viewOffset <= 0) return session;
      if (session.length === 0) return bars.slice(-1);
      const anchorDay = istDateString(session[0]!.time);
      const cutoff = viewStartFromTradingDays(bars, anchorDay, viewOffset);
      return barsFromCutoff(bars, cutoff);
    }
    case "1W": {
      const anchor = currentWeekAnchorUnix(bars, nowUnix);
      const viewStart = shiftIstWeeks(anchor, viewOffset);
      return barsFromCutoff(bars, viewStart);
    }
    case "1M": {
      const anchor = currentMonthAnchorUnix(bars, nowUnix);
      const viewStart = shiftIstMonths(anchor, viewOffset);
      return barsFromCutoff(bars, viewStart);
    }
    case "3M":
    case "6M":
    case "1Y":
    case "5Y": {
      const span = LOOKBACK_SEC[timeframeId] * (1 + viewOffset);
      return barsFromCutoff(bars, last.time - span);
    }
    default: {
      const _exhaustive: never = timeframeId;
      return _exhaustive;
    }
  }
}

/** Zoom Off chart clip — active period plus prior like-period window(s). */
export function timeframeViewBars(
  bars: OhlcBar[],
  timeframeId: ChartTimeframeId,
  opts?: { now?: Date | number }
): OhlcBar[] {
  return timeframePeriodBars(bars, timeframeId, {
    ...opts,
    viewOffset: zoomOffViewOffset(timeframeId),
  });
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
