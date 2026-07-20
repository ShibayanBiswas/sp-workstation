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
