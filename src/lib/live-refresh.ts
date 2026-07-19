/** Live markets + chart polling interval while session is open (1 minute). */
export const LIVE_REFRESH_MS = 60_000;

/** Poll much less often when markets are closed / weekend. */
export const CLOSED_REFRESH_MS = 15 * 60_000;

export function refreshIntervalForStatus(
  status: "open" | "pre-open" | "closed" | "weekend"
): number {
  return status === "open" || status === "pre-open"
    ? LIVE_REFRESH_MS
    : CLOSED_REFRESH_MS;
}
