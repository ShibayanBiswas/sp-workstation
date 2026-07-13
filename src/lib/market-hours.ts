export type MarketStatus = "open" | "pre-open" | "closed" | "weekend";

export function getNseMarketStatus(now = new Date()): MarketStatus {
  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const day = ist.getDay();
  if (day === 0 || day === 6) return "weekend";

  const minutes = ist.getHours() * 60 + ist.getMinutes();
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
