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

export function getNseMarketStatus(now = new Date()): MarketStatus {
  const { day, minutes } = istMinutesOfDay(now);
  if (day === 0 || day === 6) return "weekend";

  if (minutes >= 9 * 60 && minutes < 9 * 60 + 15) return "pre-open";
  if (minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30) return "open";
  return "closed";
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
