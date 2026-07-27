/**
 * BSE India live Sensex — LTP + session open from BSE (day % applied upstream).
 * RealTimeBseIndiaAPI/GetSensexData (official BSE print).
 *
 * Note: BSE `chg` / `perchg` are vs previous close (Zerodha/TV default).
 * We recompute day % vs I_open so tape/snapshot/1D match the trading-day open.
 */

import {
  cashQuoteMarketTime,
  getCashMarketStatus,
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
const CACHE_MS = 12_000;
let inflight: Promise<BseSensexQuote | null> | null = null;

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
  if (price == null || dayOpen == null || dayOpen === 0) return null;

  // Day % vs today's open (matches sparklines / 1D Open line).
  // Do NOT use BSE perchg — that field is vs previous close.
  const change = price - dayOpen;
  const changePercent = (change / dayOpen) * 100;

  const stamped = parseBseStamp(r.dttm);
  const status = getCashMarketStatus();
  // While cash is live, prefer BSE's dttm. When closed/pre-open/weekend/holiday,
  // always use the canonical 15:30 IST cash close so Sensex doesn't show 4:00 pm
  // (BSE post-close window) while NSE cards show 3:30 pm.
  const marketTime =
    status === "open"
      ? (stamped ?? cashQuoteMarketTime(status))
      : cashQuoteMarketTime(status);

  return {
    price,
    change,
    changePercent,
    dayOpen,
    previousClose: previousClose ?? dayOpen,
    ...(marketTime != null ? { marketTime } : {}),
  };
}

async function loadBseSensex(): Promise<BseSensexQuote | null> {
  const raw = await fetchBseSensexRaw();
  if (!raw) return cache?.quote ?? null;
  const quote = parseSensex(raw);
  if (quote) {
    cache = { at: Date.now(), quote };
  }
  return quote ?? cache?.quote ?? null;
}

/** Live Sensex quote from BSE (day % vs today's open). */
export async function fetchBseSensexQuote(): Promise<BseSensexQuote | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.quote;
  }
  if (inflight) return inflight;
  inflight = loadBseSensex().finally(() => {
    inflight = null;
  });
  return inflight;
}
