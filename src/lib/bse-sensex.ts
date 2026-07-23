/**
 * BSE India live Sensex — same previous-close basis as Zerodha Kite.
 * RealTimeBseIndiaAPI/GetSensexData (official BSE print).
 */

import {
  cashQuoteMarketTime,
  getNseMarketStatus,
} from "@/lib/market-hours";
import { fetchWithTimeout, UPSTREAM_TIMEOUT_MS } from "@/lib/fetch-timeout";

export type BseSensexQuote = {
  price: number;
  change: number;
  changePercent: number;
  dayOpen: number;
  previousClose: number;
  marketTime?: number;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type Cache = { at: number; quote: BseSensexQuote };
let cache: Cache | null = null;
/** Align with NSE short TTL so markets + chart share one Sensex print. */
const CACHE_MS = 8_000;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Best-effort parse of BSE stamp e.g. "22 Jul 26 | 10:15". */
function parseBseStamp(dttm: unknown): number | undefined {
  if (typeof dttm !== "string" || !dttm.trim()) return undefined;
  // "22 Jul 26 | 10:15" → assume IST (+05:30)
  const m = dttm.match(
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})\s*\|\s*(\d{1,2}):(\d{2})/
  );
  if (!m) return undefined;
  const [, dd, mon, yy, hh, mm] = m;
  const iso = `${dd} ${mon} 20${yy} ${hh}:${mm}:00 GMT+0530`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  return Math.floor(ms / 1000);
}

async function fetchBseSensexRaw(): Promise<unknown | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.bseindia.com/RealTimeBseIndiaAPI/api/GetSensexData/w",
      {
        cache: "no-store",
        headers: {
          "User-Agent": UA,
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.bseindia.com/",
          Origin: "https://www.bseindia.com",
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

function parseSensex(data: unknown): BseSensexQuote | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  const price = num(r.ltp);
  const previousClose = num(r.Prev_Close);
  const dayOpen = num(r.I_open) ?? previousClose;
  if (price == null || previousClose == null || previousClose === 0) return null;

  const change = num(r.chg) ?? price - previousClose;
  const changePercent =
    num(r.perchg) ?? (change / previousClose) * 100;

  const stamped = parseBseStamp(r.dttm);
  // Prefer BSE's own dttm; if missing/unparseable, use last cash close — not "now"
  // (which wrongly showed Thursday morning as the last session).
  const marketTime = stamped ?? cashQuoteMarketTime(getNseMarketStatus());

  return {
    price,
    change,
    changePercent,
    dayOpen: dayOpen ?? previousClose,
    previousClose,
    ...(marketTime != null ? { marketTime } : {}),
  };
}

/** Live Sensex quote from BSE (Zerodha-compatible %). */
export async function fetchBseSensexQuote(opts?: {
  fresh?: boolean;
}): Promise<BseSensexQuote | null> {
  void opts;
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.quote;
  }
  const raw = await fetchBseSensexRaw();
  if (!raw) return cache?.quote ?? null;
  const quote = parseSensex(raw);
  if (quote) {
    cache = { at: Date.now(), quote };
  }
  return quote ?? cache?.quote ?? null;
}
