import { getFxMarketStatus, getNseMarketStatus } from "@/lib/market-hours";

/** Live markets + chart polling while session is open (~Zerodha-feel refresh). */
export const LIVE_REFRESH_MS = 15_000;

/** Poll much less often when markets are closed / weekend. */
export const CLOSED_REFRESH_MS = 15 * 60_000;

export function refreshIntervalForStatus(
  status: "open" | "pre-open" | "closed" | "weekend"
): number {
  return status === "open" || status === "pre-open"
    ? LIVE_REFRESH_MS
    : CLOSED_REFRESH_MS;
}

/**
 * Tape poll cadence: keep refreshing while cash OR FX is open so USD/INR
 * stays live overnight even when NSE/BSE cash is closed.
 */
export function refreshIntervalForTape(now = new Date()): number {
  const cash = getNseMarketStatus(now);
  if (cash === "open" || cash === "pre-open") return LIVE_REFRESH_MS;
  if (getFxMarketStatus(now) === "open") return LIVE_REFRESH_MS;
  return CLOSED_REFRESH_MS;
}
