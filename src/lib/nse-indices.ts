/**
 * NSE India live indices — LTP + session open from NSE (day % applied upstream).
 * Warm a cookie session, then pull /api/allIndices.
 *
 * NSE omits print timestamps. Callers should combine with Yahoo "today bars"
 * (see markets finalizeQuote) to decide sessionPrinted / awaiting-print.
 */

import {
  cashQuoteMarketTime,
  getCashMarketStatus,
} from "@/lib/market-hours";
import { fetchWithTimeout, UPSTREAM_TIMEOUT_MS } from "@/lib/fetch-timeout";

export type NseIndexQuote = {
  price: number;
  change: number;
  changePercent: number;
  dayOpen: number;
  previousClose: number;
  /** Best-effort unix seconds (NSE payload often omits a stamp). */
  marketTime?: number;
};

const NSE_INDEX_BY_ID: Record<string, string> = {
  nifty: "NIFTY 50",
  banknifty: "NIFTY BANK",
  midcap: "NIFTY MIDCAP 100",
  next50: "NIFTY NEXT 50",
  niftyit: "NIFTY IT",
  niftyauto: "NIFTY AUTO",
  niftyfmcg: "NIFTY FMCG",
  niftymetal: "NIFTY METAL",
  niftypharma: "NIFTY PHARMA",
  niftyenergy: "NIFTY ENERGY",
  niftyfin: "NIFTY FINANCIAL SERVICES",
  vix: "INDIA VIX",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type Cache = { at: number; byId: Map<string, NseIndexQuote> };
let cache: Cache | null = null;
/** Short TTL — client polls ~15s during open; share across markets+chart. */
const CACHE_MS = 12_000;
let inflight: Promise<Map<string, NseIndexQuote>> | null = null;

/** Reuse NSE cookies across warm instances — skip HTML warm on every poll. */
let nseCookie = "";
let nseCookieAt = 0;
const NSE_COOKIE_TTL_MS = 5 * 60_000;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function cookieHeaderFromResponse(res: Response): string {
  const getSetCookie = (
    res.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  if (typeof getSetCookie === "function") {
    return getSetCookie
      .call(res.headers)
      .map((c) => c.split(";")[0]!.trim())
      .filter(Boolean)
      .join("; ");
  }
  const raw = res.headers.get("set-cookie");
  if (!raw) return "";
  // Node may join multiple Set-Cookie values; take name=value only.
  return raw
    .split(/,(?=[^;=]+=[^;]+)/)
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");
}

export function nseIndexNameForId(id: string): string | undefined {
  return NSE_INDEX_BY_ID[id];
}

async function ensureNseCookie(): Promise<string> {
  if (nseCookie && Date.now() - nseCookieAt < NSE_COOKIE_TTL_MS) {
    return nseCookie;
  }
  try {
    const warm = await fetchWithTimeout(
      "https://www.nseindia.com/market-data/live-market-indices",
      {
        cache: "no-store",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      UPSTREAM_TIMEOUT_MS
    );
    const cookie = cookieHeaderFromResponse(warm);
    if (cookie) {
      nseCookie = cookie;
      nseCookieAt = Date.now();
    }
  } catch {
    /* keep prior cookie if any */
  }
  return nseCookie;
}

async function fetchNseAllIndicesRaw(): Promise<unknown | null> {
  try {
    const cookie = await ensureNseCookie();
    const res = await fetchWithTimeout(
      "https://www.nseindia.com/api/allIndices",
      {
        cache: "no-store",
        headers: {
          "User-Agent": UA,
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.nseindia.com/market-data/live-market-indices",
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      UPSTREAM_TIMEOUT_MS
    );
    if (res.status === 401 || res.status === 403) {
      // Cookie rejected — force re-warm once.
      nseCookie = "";
      nseCookieAt = 0;
      const retryCookie = await ensureNseCookie();
      const retry = await fetchWithTimeout(
        "https://www.nseindia.com/api/allIndices",
        {
          cache: "no-store",
          headers: {
            "User-Agent": UA,
            Accept: "application/json,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.nseindia.com/market-data/live-market-indices",
            ...(retryCookie ? { Cookie: retryCookie } : {}),
          },
        },
        UPSTREAM_TIMEOUT_MS
      );
      if (!retry.ok) return null;
      return await retry.json();
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parseAllIndices(data: unknown): Map<string, NseIndexQuote> {
  const byId = new Map<string, NseIndexQuote>();
  const rows = (
    data as { data?: Array<Record<string, unknown>> } | null
  )?.data;
  if (!Array.isArray(rows)) return byId;

  const byName = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const name = typeof row.index === "string" ? row.index : "";
    if (name) byName.set(name, row);
  }

  // NSE omits print timestamps. Do not stamp "now" here — that falsely marks
  // holiday/early-open quotes as sessionPrinted. Callers confirm today via
  // Yahoo bars / open-vs-prevClose, then apply cashQuoteMarketTime.
  const status = getCashMarketStatus();
  const marketTime =
    status === "open" ? undefined : cashQuoteMarketTime(status);

  for (const [id, nseName] of Object.entries(NSE_INDEX_BY_ID)) {
    const row = byName.get(nseName);
    if (!row) continue;
    const price = num(row.last);
    const previousClose = num(row.previousClose);
    const dayOpen = num(row.open) ?? previousClose;
    if (price == null || dayOpen == null || dayOpen === 0) continue;

    // Day % vs today's open (matches sparklines / 1D Open line).
    // NSE percentChange is vs previous close — do not use it here.
    const change = price - dayOpen;
    const changePercent = (change / dayOpen) * 100;

    byId.set(id, {
      price,
      change,
      changePercent,
      dayOpen,
      previousClose: previousClose ?? dayOpen,
      ...(marketTime != null ? { marketTime } : {}),
    });
  }
  return byId;
}

async function loadNseQuotes(): Promise<Map<string, NseIndexQuote>> {
  const raw = await fetchNseAllIndicesRaw();
  if (!raw) return cache?.byId ?? new Map();
  const byId = parseAllIndices(raw);
  if (byId.size > 0) {
    cache = { at: Date.now(), byId };
  }
  return byId.size > 0 ? byId : (cache?.byId ?? new Map());
}

/**
 * Fresh map of workstation index id → NSE live quote (day % vs today's open).
 * Short TTL + single-flight so /api/markets and /api/chart share one print.
 * `fresh` only skips cache when the TTL has already expired (never blocks
 * on a forced cold fetch while a warm print exists).
 */
export async function fetchNseIndexQuotes(): Promise<Map<string, NseIndexQuote>> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.byId;
  }
  if (inflight) return inflight;
  inflight = loadNseQuotes().finally(() => {
    inflight = null;
  });
  return inflight;
}
