import type { OhlcBar } from "@/lib/yahoo-ohlc";

import type { Time } from "lightweight-charts";

const IST = "Asia/Kolkata";

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

/** Keep only bars inside Indian cash-market hours for intraday charts. */
export function filterNseSessionBars(bars: OhlcBar[], intraday: boolean): OhlcBar[] {
  if (!intraday) return bars;
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

export function formatIstDateTime(unixSec: number, intraday: boolean): string {
  if (intraday) {
    return new Date(unixSec * 1000).toLocaleString("en-IN", {
      timeZone: IST,
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

export function formatIstAxisLabel(unixSec: number, intraday: boolean): string {
  if (intraday) {
    return new Date(unixSec * 1000).toLocaleTimeString("en-IN", {
      timeZone: IST,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return new Date(unixSec * 1000).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
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
