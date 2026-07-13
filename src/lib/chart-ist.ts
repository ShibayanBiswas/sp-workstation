import type { OhlcBar } from "@/lib/yahoo-ohlc";

import type { Time } from "lightweight-charts";

const IST = "Asia/Kolkata";

export type AxisLabelMode = "time" | "day" | "date";

/** NSE cash session: 09:15 – 15:30 IST (inclusive). */
export function isNseSessionMinute(unixSec: number): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date(unixSec * 1000));

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (weekday === "Sat" || weekday === "Sun") return false;

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const total = hour * 60 + minute;
  return total >= 9 * 60 + 15 && total <= 15 * 60 + 30;
}

/** Symbols that trade outside NSE cash hours (keep all intraday bars). */
const NON_NSE_SESSION_SYMBOLS = new Set(["INR=X"]);

/** Keep only bars inside Indian cash-market hours for intraday charts. */
export function filterNseSessionBars(
  bars: OhlcBar[],
  intraday: boolean,
  yahooSymbol?: string
): OhlcBar[] {
  if (!intraday) return bars;
  if (yahooSymbol && NON_NSE_SESSION_SYMBOLS.has(yahooSymbol)) return bars;
  const filtered = bars.filter((b) => isNseSessionMinute(b.time));
  return filtered.length > 0 ? filtered : bars;
}

export function istDateString(unixSec: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(unixSec * 1000));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function istParts(unixSec: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(unixSec * 1000));
}

function part(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** Compact axis label — no locale quirks, no truncation from long suffixes. */
export function formatIstAxisLabel(
  unixSec: number,
  mode: AxisLabelMode
): string {
  const parts = istParts(unixSec);
  if (mode === "time") {
    const hour = part(parts, "hour");
    const minute = part(parts, "minute");
    return `${hour}:${minute}`;
  }
  if (mode === "day") {
    const weekday = new Date(unixSec * 1000).toLocaleDateString("en-IN", {
      timeZone: IST,
      weekday: "short",
    });
    const day = part(parts, "day");
    return `${weekday} ${day}`;
  }
  const day = part(parts, "day");
  const month = new Date(unixSec * 1000).toLocaleDateString("en-IN", {
    timeZone: IST,
    month: "short",
  });
  return `${day} ${month}`;
}

/** Creates a tick formatter that shows one label per IST calendar day (for 1W). */
export function createDayAxisTickFormatter(mode: AxisLabelMode) {
  let lastDayKey = "";
  return (unixSec: number): string => {
    if (mode !== "day") {
      return formatIstAxisLabel(unixSec, mode);
    }
    const dayKey = istDateString(unixSec);
    if (dayKey === lastDayKey) return "";
    lastDayKey = dayKey;
    return formatIstAxisLabel(unixSec, "day");
  };
}

export function formatIstDateTime(unixSec: number, mode: AxisLabelMode): string {
  if (mode === "time") {
    return new Date(unixSec * 1000).toLocaleString("en-IN", {
      timeZone: IST,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (mode === "day") {
    return new Date(unixSec * 1000).toLocaleString("en-IN", {
      timeZone: IST,
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return new Date(unixSec * 1000).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function timeToUnix(time: Time): number {
  if (typeof time === "number") return time;
  if (typeof time === "string") {
    const [y, m, d] = time.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 1000);
  }
  return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
}

export function formatIstHeaderTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
