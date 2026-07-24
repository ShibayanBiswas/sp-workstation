/**
 * Session-open basis for tape / Snapshot / 1D chart day %.
 * Every index uses its own venue open (NSE, BSE, or FX Yahoo) vs LTP.
 * Holidays / weekends / empty mornings fall back to the last trading day's open.
 */

import { istCalendarDate } from "@/lib/market-hours";
import { istDateString, tradingSessionBars } from "@/lib/chart-ist";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

export function changeVersusSessionOpen(
  price: number,
  sessionOpen: number
): { change: number; changePercent: number } {
  const change = price - sessionOpen;
  const changePercent =
    sessionOpen !== 0 && Number.isFinite(sessionOpen)
      ? (change / sessionOpen) * 100
      : 0;
  return { change, changePercent };
}

/** True when the active tradingSessionBars belong to today's IST calendar. */
export function sessionBarsAreToday(
  bars: OhlcBar[],
  now: Date | number = new Date()
): boolean {
  if (bars.length === 0) return false;
  const nowSec =
    typeof now === "number" ? now : Math.floor(now.getTime() / 1000);
  return istDateString(bars[0]!.time) === istCalendarDate(nowSec);
}

/**
 * Pick the open used for day % and spark anchors.
 *
 * - Live session (venue print or OHLC is today) → prefer exchange/Yahoo venue open
 * - Holiday / weekend / empty morning (neither is today) → prefer OHLC first print
 *   of the last completed session (matches the plotted day)
 */
export function resolveSessionOpen(opts: {
  venueOpen?: number | null;
  ohlcSessionOpen?: number | null;
  /** OHLC tradingSessionBars belong to today IST. */
  sessionIsToday?: boolean;
  /** Venue already has today's print (NSE/BSE/FX stamp) — beats lagged Yahoo OHLC. */
  venueIsToday?: boolean;
}): number | null {
  const venue =
    opts.venueOpen != null &&
    Number.isFinite(opts.venueOpen) &&
    opts.venueOpen > 0
      ? opts.venueOpen
      : null;
  const ohlc =
    opts.ohlcSessionOpen != null &&
    Number.isFinite(opts.ohlcSessionOpen) &&
    opts.ohlcSessionOpen > 0
      ? opts.ohlcSessionOpen
      : null;

  const isToday =
    opts.venueIsToday === true || opts.sessionIsToday === true;

  if (!isToday) {
    return ohlc ?? venue;
  }
  return venue ?? ohlc;
}

/** Open of the trading session represented by these OHLC bars. */
export function ohlcSessionOpen(
  bars: OhlcBar[],
  opts?: { fx?: boolean; now?: Date | number }
): number | null {
  const session = tradingSessionBars(bars, opts);
  if (session.length === 0) return null;
  const open = session[0]!.open;
  return Number.isFinite(open) && open > 0 ? open : null;
}
