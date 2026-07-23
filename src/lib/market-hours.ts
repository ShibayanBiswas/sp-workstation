export type MarketStatus = "open" | "pre-open" | "closed" | "weekend";

const IST = "Asia/Kolkata";

function istMinutesOfDay(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day =
    weekday === "Sun"
      ? 0
      : weekday === "Mon"
        ? 1
        : weekday === "Tue"
          ? 2
          : weekday === "Wed"
            ? 3
            : weekday === "Thu"
              ? 4
              : weekday === "Fri"
                ? 5
                : weekday === "Sat"
                  ? 6
                  : now.getDay();

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { day, minutes: hour * 60 + minute };
}

/** Calendar date in IST as YYYY-MM-DD. */
export function istCalendarDate(input: Date | number = new Date()): string {
  const d = typeof input === "number" ? new Date(input * 1000) : input;
  return d.toLocaleDateString("en-CA", { timeZone: IST });
}

/** True when unix seconds fall on today's IST calendar day. */
export function isSameIstDay(
  unixSec: number | null | undefined,
  now = new Date()
): boolean {
  if (unixSec == null || !Number.isFinite(unixSec)) return false;
  return istCalendarDate(unixSec) === istCalendarDate(now);
}

/**
 * Cash indices are "session-printed" only once the feed shows a print on
 * today's IST date. During early open, some feeds (notably Sensex/^BSESN)
 * can lag while Nifty is already live — treat those as awaiting today's print.
 */
export function hasTodaySessionPrint(
  marketTime: number | null | undefined,
  now = new Date()
): boolean {
  return isSameIstDay(marketTime, now);
}

export function getNseMarketStatus(now = new Date()): MarketStatus {
  const { day, minutes } = istMinutesOfDay(now);
  if (day === 0 || day === 6) return "weekend";

  if (minutes >= 9 * 60 && minutes < 9 * 60 + 15) return "pre-open";
  if (minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30) return "open";
  return "closed";
}

const CASH_CLOSE_MINUTES = 15 * 60 + 30; // 15:30 IST

function subtractIstCalendarDays(yyyyMmDd: string, days: number): string {
  const base = new Date(`${yyyyMmDd}T12:00:00+05:30`);
  base.setUTCDate(base.getUTCDate() - days);
  return istCalendarDate(base);
}

/**
 * Unix seconds for the most recent completed NSE/BSE cash close (15:30 IST).
 * Used for closed / pre-open / weekend “last session” stamps when the feed
 * has no print timestamp (NSE) or the stamp is missing (BSE fallback).
 */
export function lastCashSessionCloseUnix(now = new Date()): number {
  const { day, minutes } = istMinutesOfDay(now);
  const today = istCalendarDate(now);

  let daysBack = 0;
  if (day === 0) {
    daysBack = 2; // Sunday → Friday
  } else if (day === 6) {
    daysBack = 1; // Saturday → Friday
  } else if (minutes < CASH_CLOSE_MINUTES) {
    // Before today's close — last completed session is the previous weekday.
    daysBack = day === 1 ? 3 : 1; // Monday → Friday
  }

  const sessionDay = daysBack === 0 ? today : subtractIstCalendarDays(today, daysBack);
  return Math.floor(
    new Date(`${sessionDay}T15:30:00+05:30`).getTime() / 1000
  );
}

/**
 * Best-effort print time for cash quotes:
 * - live open session → now
 * - otherwise → last cash close (never the page-load clock before open)
 */
export function cashQuoteMarketTime(
  status: MarketStatus = getNseMarketStatus(),
  now = new Date()
): number {
  if (status === "open") {
    return Math.floor(now.getTime() / 1000);
  }
  return lastCashSessionCloseUnix(now);
}

/**
 * USD/INR (and similar) trade nearly 24×5. Treat Sat + early Sun IST as weekend;
 * otherwise FX is open even when NSE cash is closed.
 */
export function getFxMarketStatus(now = new Date()): "open" | "weekend" {
  const { day, minutes } = istMinutesOfDay(now);
  if (day === 6) return "weekend"; // Saturday
  if (day === 0 && minutes < 18 * 60) return "weekend"; // Sunday before ~18:00 IST
  return "open";
}

/** Prefer exchange print; fall back to now while FX is open. */
export function fxQuoteMarketTime(
  feedTime: number | null | undefined,
  now = new Date()
): number | undefined {
  if (feedTime != null && Number.isFinite(feedTime) && feedTime > 0) {
    return feedTime;
  }
  if (getFxMarketStatus(now) === "open") {
    return Math.floor(now.getTime() / 1000);
  }
  return undefined;
}

/** FX is live when the 24×5 window is open and we have a fresh-enough print. */
export function isFxInstrumentLive(
  marketTime: number | null | undefined,
  now = new Date()
): boolean {
  if (getFxMarketStatus(now) !== "open") return false;
  if (marketTime == null || !Number.isFinite(marketTime)) return false;
  const ageSec = Math.floor(now.getTime() / 1000) - marketTime;
  // Yahoo FX can lag a few minutes; allow a generous freshness window.
  return ageSec >= 0 && ageSec <= 30 * 60;
}

/** True while cash market is trading (or in pre-open). */
export function isMarketSessionActive(status: MarketStatus): boolean {
  return status === "open" || status === "pre-open";
}

/** True only during continuous trading — drives live pulses / countdowns. */
export function isMarketLive(status: MarketStatus): boolean {
  return status === "open";
}

/**
 * Per-instrument live: venue session is open AND this symbol already has
 * today's IST print. Prevents Sensex-from-Friday looking "Synced" on Monday.
 */
export function isInstrumentSessionLive(
  status: MarketStatus,
  marketTime: number | null | undefined,
  now = new Date()
): boolean {
  return isMarketSessionActive(status) && hasTodaySessionPrint(marketTime, now);
}

/** Venue open/pre-open but this symbol still on a prior-session print. */
export function isAwaitingTodayPrint(
  status: MarketStatus,
  marketTime: number | null | undefined,
  now = new Date()
): boolean {
  return (
    isMarketSessionActive(status) && !hasTodaySessionPrint(marketTime, now)
  );
}

export function marketStatusLabel(status: MarketStatus): string {
  switch (status) {
    case "open":
      return "Markets Open";
    case "pre-open":
      return "Pre-Open Session";
    case "weekend":
      return "Weekend — Closed";
    case "closed":
      return "Markets Closed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
