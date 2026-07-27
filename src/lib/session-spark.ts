/**
 * Tape / Snapshot session sparklines only.
 * Builds the active cash-session path from open → LTP (grows through the day).
 * Pre-open / holiday / weekend → last completed session (never mixes days).
 */

import { istDateString } from "@/lib/chart-ist";
import type { MarketStatus } from "@/lib/market-hours";
import { getCashMarketStatus } from "@/lib/market-hours";
import type { OhlcBar } from "@/lib/yahoo-ohlc";

export type SessionSparkSelection = {
  bars: OhlcBar[];
  /** True when the selected session is today's IST cash session. */
  sessionIsToday: boolean;
  sessionOpen: number | null;
  sessionLastClose: number | null;
};

function barsByIstDay(bars: OhlcBar[]): Map<string, OhlcBar[]> {
  const map = new Map<string, OhlcBar[]>();
  for (const bar of bars) {
    const day = istDateString(bar.time);
    const list = map.get(day);
    if (list) list.push(bar);
    else map.set(day, [bar]);
  }
  return map;
}

/**
 * Pick which cash session the tape/snapshot spark should draw.
 *
 * - Live open + today's bars → today from 09:15 (grows as bars print)
 * - Pre-open / closed / weekend / holiday → last completed session only
 * - Live open but Yahoo still on a prior day → empty today (caller uses open→LTP)
 */
export function selectTapeSessionBars(
  bars: OhlcBar[],
  opts?: { now?: Date | number; status?: MarketStatus }
): SessionSparkSelection {
  if (bars.length === 0) {
    return {
      bars: [],
      sessionIsToday: false,
      sessionOpen: null,
      sessionLastClose: null,
    };
  }

  const now =
    opts?.now == null
      ? new Date()
      : typeof opts.now === "number"
        ? new Date(opts.now * 1000)
        : opts.now;
  const status = opts?.status ?? getCashMarketStatus(now);
  const today = istDateString(Math.floor(now.getTime() / 1000));
  const byDay = barsByIstDay(bars);
  const days = [...byDay.keys()].sort();
  const todayBars = byDay.get(today) ?? [];

  let sessionBars: OhlcBar[];
  let sessionIsToday = false;

  if (status === "open" && todayBars.length > 0) {
    sessionBars = todayBars;
    sessionIsToday = true;
  } else if (status === "open") {
    // Cash is live but Yahoo has not printed today yet — do not draw yesterday.
    sessionBars = [];
    sessionIsToday = false;
  } else {
    // Pre-open / closed / weekend / holiday → last completed session.
    const priorDay =
      [...days].reverse().find((d) => d < today) ?? days[days.length - 1]!;
    sessionBars = byDay.get(priorDay) ?? [];
    sessionIsToday = false;
  }

  const open = sessionBars[0]?.open;
  const lastClose = sessionBars[sessionBars.length - 1]?.close;

  return {
    bars: sessionBars,
    sessionIsToday,
    sessionOpen:
      open != null && Number.isFinite(open) && open > 0 ? open : null,
    sessionLastClose:
      lastClose != null && Number.isFinite(lastClose) && lastClose > 0
        ? lastClose
        : null,
  };
}

/** Price path for sparklineSeries — always starts at session open. */
export function sessionSparkPrices(
  sessionBars: OhlcBar[],
  liveTip: number,
  maxPoints = 96
): number[] {
  if (sessionBars.length === 0) {
    return Number.isFinite(liveTip) && liveTip > 0 ? [liveTip, liveTip] : [];
  }

  const sessionOpen = sessionBars[0]!.open;
  if (!Number.isFinite(sessionOpen) || sessionOpen === 0) return [];

  const prices: number[] = [sessionOpen];
  for (const bar of sessionBars) {
    if (Number.isFinite(bar.close)) prices.push(bar.close);
  }
  if (prices.length < 2) {
    prices.push(sessionBars[0]!.close);
  }
  if (prices.length < 2) return [];

  prices[prices.length - 1] = liveTip;

  if (prices.length <= maxPoints) return prices;

  const step = Math.ceil((prices.length - 1) / (maxPoints - 1));
  const sampled: number[] = [prices[0]!];
  for (let i = step; i < prices.length - 1; i += step) {
    sampled.push(prices[i]!);
  }
  sampled.push(prices[prices.length - 1]!);
  return sampled;
}
