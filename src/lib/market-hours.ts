export type MarketStatus = "open" | "pre-open" | "closed" | "weekend";

const IST = "Asia/Kolkata";

/**
 * NSE + BSE equity cash holidays (weekday closures).
 * Both exchanges share this calendar for cash indices (Nifty, Sensex, sectors, VIX).
 * Source: NSE holiday circular for 2026 (BSE mirrors for cash equities).
 * Weekend-only observances are omitted — weekends already return "weekend".
 */
const CASH_HOLIDAYS_IST = new Set<string>([
  "2026-01-26", // Republic Day
  "2026-03-03", // Holi
  "2026-03-26", // Shri Ram Navami
  "2026-03-31", // Shri Mahavir Jayanti
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
  "2026-05-01", // Maharashtra Day
  "2026-05-28", // Bakri Id
  "2026-06-26", // Muharram
  "2026-09-14", // Ganesh Chaturthi
  "2026-10-02", // Mahatma Gandhi Jayanti
  "2026-10-20", // Dussehra
  "2026-11-10", // Diwali-Balipratipada
  "2026-11-24", // Prakash Gurpurb Sri Guru Nanak Dev
  "2026-12-25", // Christmas
]);

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

/** True when the IST calendar date is a declared NSE/BSE cash holiday. */
export function isCashHoliday(
  input: Date | number | string = new Date()
): boolean {
  const day =
    typeof input === "string" ? input : istCalendarDate(input);
  return CASH_HOLIDAYS_IST.has(day);
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

/**
 * NSE + BSE equity cash session clock (identical hours):
 * - Pre-open 09:00–09:14 IST
 * - Continuous 09:15–15:30 IST
 * - Weekends + declared cash holidays → not trading
 *
 * Sensex (BSE) and Nifty family (NSE) both use this clock.
 */
export function getCashMarketStatus(now = new Date()): MarketStatus {
  const { day, minutes } = istMinutesOfDay(now);
  if (day === 0 || day === 6) return "weekend";
  if (isCashHoliday(now)) return "closed";

  if (minutes >= 9 * 60 && minutes < 9 * 60 + 15) return "pre-open";
  if (minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30) return "open";
  return "closed";
}

/** @deprecated Prefer getCashMarketStatus — NSE/BSE cash share one clock. */
export const getNseMarketStatus = getCashMarketStatus;

const CASH_CLOSE_MINUTES = 15 * 60 + 30; // 15:30 IST

function subtractIstCalendarDays(yyyyMmDd: string, days: number): string {
  const base = new Date(`${yyyyMmDd}T12:00:00+05:30`);
  base.setUTCDate(base.getUTCDate() - days);
  return istCalendarDate(base);
}

/** Walk back from an IST date to the previous weekday that is not a cash holiday. */
function previousCashSessionDay(yyyyMmDd: string): string {
  let cursor = yyyyMmDd;
  for (let i = 0; i < 14; i++) {
    cursor = subtractIstCalendarDays(cursor, 1);
    const istDow = new Date(`${cursor}T12:00:00+05:30`).toLocaleDateString(
      "en-US",
      { timeZone: IST, weekday: "short" }
    );
    if (istDow === "Sat" || istDow === "Sun") continue;
    if (isCashHoliday(cursor)) continue;
    return cursor;
  }
  return cursor;
}

/**
 * Unix seconds for the most recent completed NSE/BSE cash close (15:30 IST).
 * Used for closed / pre-open / weekend / holiday “last session” stamps when the
 * feed has no print timestamp (NSE) or the stamp is missing (BSE fallback).
 * Skips weekends and declared cash holidays.
 */
export function lastCashSessionCloseUnix(now = new Date()): number {
  const { day, minutes } = istMinutesOfDay(now);
  const today = istCalendarDate(now);
  const isWeekday = day >= 1 && day <= 5;
  const tradingToday = isWeekday && !isCashHoliday(now);

  // After today's continuous session close on a trading day → today 15:30.
  // Otherwise → previous cash session day (skips weekends + holidays).
  const sessionDay =
    tradingToday && minutes >= CASH_CLOSE_MINUTES
      ? today
      : previousCashSessionDay(today);

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
  status: MarketStatus = getCashMarketStatus(),
  now = new Date()
): number {
  if (status === "open") {
    return Math.floor(now.getTime() / 1000);
  }
  return lastCashSessionCloseUnix(now);
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
