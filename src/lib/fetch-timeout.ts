/** Timed fetch helpers so upstream market APIs cannot hang the app. */

/** Per-upstream call (Yahoo / NSE / BSE). Keep tight for Vercel. */
export const UPSTREAM_TIMEOUT_MS = 5_000;
/** Browser abort for /api/markets and /api/chart. */
export const CLIENT_API_TIMEOUT_MS = 12_000;
/** Whole serverless handler budget before returning stale/partial data. */
export const ROUTE_BUDGET_MS = 12_000;

/**
 * fetch() with an absolute timeout. Combines with any existing AbortSignal.
 * On timeout / abort, fetch rejects — callers should catch and fall back.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number = UPSTREAM_TIMEOUT_MS
): Promise<Response> {
  const timeout = AbortSignal.timeout(ms);
  const signal =
    init?.signal != null
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
  return fetch(input, { ...init, signal });
}

/** Race a promise against a timer; returns fallback on timeout. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}
