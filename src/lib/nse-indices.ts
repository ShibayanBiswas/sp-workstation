/**
 * NSE India live indices — LTP + session open from NSE (day % applied upstream).
 * Warm a cookie session, then pull /api/allIndices.
 */

import {
  cashQuoteMarketTime,
  getNseMarketStatus,
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
const CACHE_MS = 8_000;

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

async function fetchNseAllIndicesRaw(): Promise<unknown | null> {
  try {
    // Cookie warm-up (NSE often 403s without it). Node fetch has no jar —
    // forward Set-Cookie explicitly on the API call.
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

  // NSE omits print timestamps. During the live session use "now"; otherwise
  // stamp the last cash close (15:30 IST) — never the pre-open fetch clock.
  const marketTime = cashQuoteMarketTime(getNseMarketStatus());

  for (const [id, nseName] of Object.entries(NSE_INDEX_BY_ID)) {
    const row = byName.get(nseName);
    if (!row) continue;
    const price = num(row.last);
    const previousClose = num(row.previousClose);
    const dayOpen = num(row.open) ?? previousClose;
    if (price == null || dayOpen == null || dayOpen === 0) continue;

    // Day % vs today's open (matches sparklines / 1D Open line).
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

/**
 * Fresh map of workstation index id → NSE live quote (day % vs today's open).
 * Short TTL is always honored so /api/markets and /api/chart share one print.
 */
export async function fetchNseIndexQuotes(opts?: {
  fresh?: boolean;
}): Promise<Map<string, NseIndexQuote>> {
  void opts;
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.byId;
  }
  const raw = await fetchNseAllIndicesRaw();
  if (!raw) return cache?.byId ?? new Map();
  const byId = parseAllIndices(raw);
  if (byId.size > 0) {
    cache = { at: Date.now(), byId };
  }
  return byId;
}
